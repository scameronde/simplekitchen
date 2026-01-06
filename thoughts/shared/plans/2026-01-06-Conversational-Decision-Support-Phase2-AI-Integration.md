---
date: 2026-01-06
planner: assistant
epic-source: 'thoughts/shared/epics/2025-12-25-Conversational-Decision-Support.md'
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
phase: 2
phase-name: 'AI Integration & Contextual Questions'
prerequisites: 'Phase 0 (Data Foundation) COMPLETE, Phase 1 (Conversation Infrastructure) COMPLETE'
status: ready-for-implementation
type: detailed-plan
---

# Phase 2: AI Integration & Contextual Questions

## Executive Summary

**Goal**: Integrate OpenAI to generate contextual questions and capture user context (energy level, available time, mood, shopping capability) through natural conversation.

**Current State**: Phase 1 complete—conversation infrastructure exists with echo mode. Session manager, IPC handlers, and UI are functional but not AI-powered.

**Target State**: System conducts supportive conversation to gather user context, adapting questions based on responses. User context (energyLevel, availableTime, mood, canShop) is reliably captured in session state. Conversation state transitions from 'gathering' to 'suggesting' when sufficient context is collected.

**Scope**: 7 implementation tasks covering conversation schema, prompt engineering, AI service integration, and testing.

**Duration Estimate**: 7-10 days

---

## Inputs

### Research Report Used

- **File**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
- **Key Findings**:
  - OpenAI GPT-4o-mini integration exists (`recipe-generator.ts`)
  - Structured outputs with Zod schemas is established pattern
  - Prompting strategy with supportive tone (lines 230-298)
  - Performance target: <5s per turn (achievable with GPT-4o-mini)

### Master Plan Reference

- **File**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
- **Phase 2 Definition**: Lines 117-153
- **Acceptance Criteria**: Lines 139-150
- **Architectural Decisions**: Lines 391-410

### User Request Summary

Plan Phase 2 of Conversational Decision Support epic, implementing AI integration for contextual question generation and user context capture.

---

## Verified Current State

### Fact 1: Phase 1 Infrastructure is Complete

**Evidence**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase1-STATE.md:4-5`

**Excerpt**:

```
**Current Task**: COMPLETE
**Completed Tasks**: PLAN-001, PLAN-002, PLAN-003, PLAN-004, PLAN-005, PLAN-006, PLAN-007, PLAN-008, PLAN-009, PLAN-010
```

**Implication**: Session manager, IPC handlers, UI components, and tests exist and are verified. Phase 2 can proceed without infrastructure blockers.

---

### Fact 2: Session Manager Supports In-Memory State

**Evidence**: `src/main/conversation/session-manager.ts:18-33`

**Excerpt**:

```typescript
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
```

**Implication**: Session object has `userContext`, `state`, and `messages` fields ready for AI integration. No schema changes needed.

---

### Fact 3: OpenAI Client Pattern Exists

**Evidence**: `src/main/ai/recipe-generator.ts:17-31`

**Excerpt**:

```typescript
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please add your API key to the .env file.'
      );
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 seconds
      maxRetries: 2,
    });
  }
  return openai;
}
```

**Implication**: Conversation service can reuse this pattern. Same timeout (30s) and retry (2) settings apply.

---

### Fact 4: Structured Output with Zod is Established Pattern

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

**Implication**: Conversation service must follow same pattern—define Zod schema, use `chat.completions.parse()`, handle `message.parsed` result.

---

### Fact 5: Dietary Profile DAL Exists

**Evidence**: `src/main/database/dal/dietary-profile.ts:6-27`

**Excerpt**:

```typescript
export async function getDietaryProfile(): Promise<DietaryProfile> {
  const row = await db
    .selectFrom('dietary_profile')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();

  if (!row) {
    throw new Error('Dietary profile not found');
  }

  return {
    id: row.id,
    hardRestrictions: JSON.parse(row.hard_restrictions),
    preferences: JSON.parse(row.preferences),
    explicitInclusions: JSON.parse(row.explicit_inclusions),
    explicitExclusions: JSON.parse(row.explicit_exclusions),
    updatedAt: new Date(row.updated_at),
  };
}
```

**Implication**: Conversation service can fetch dietary restrictions to include in system prompt. NO new DAL needed.

---

### Fact 6: IPC Handler Currently Uses Echo Mode

**Evidence**: `src/main/ipc/conversation-handlers.ts:56-62`

**Excerpt**:

```typescript
// Phase 1: Echo back (NO AI)
const aiMessage: ConversationMessage = {
  role: 'assistant',
  content: `Echo: ${message}`,
  timestamp: new Date(),
};
updateSessionMessages(sessionId, aiMessage);
```

**Implication**: This is the exact location to replace echo logic with conversation service call. Handler structure is already correct.

---

### Fact 7: ConversationSession Type Includes All Required Fields

**Evidence**: `src/shared/types/conversation.ts:75-88`

**Excerpt**:

```typescript
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
  createdAt: Date;
  lastActivity: Date;
}
```

**Implication**: Session state supports all Phase 2 requirements. `userContext` field is ready for energyLevel, availableTime, mood, canShop.

---

## Goals / Non-Goals

### Goals

1. **AI-Powered Contextual Questions**: System asks opening question ("How's your energy level?") and adapts follow-up questions based on user responses.

2. **Reliable Context Extraction**: User context (energyLevel, availableTime, mood, canShop) is captured via structured AI output, not fragile regex parsing.

3. **State Transition Logic**: Conversation state transitions from 'gathering' to 'suggesting' when sufficient context is collected (e.g., energyLevel + availableTime captured).

4. **Performance Target**: AI response time <5 seconds per turn (verified achievable with GPT-4o-mini from research).

5. **Error Handling**: Graceful degradation if AI unavailable (fallback: skip to suggesting with default context).

### Non-Goals

1. **Recipe Suggestion Logic**: Phase 3 responsibility. Phase 2 stops at context gathering.

2. **Refinement Loop**: Phase 4 responsibility. Phase 2 does not handle recipe feedback.

3. **XState Integration**: Decision made to use simple state enum for MVP. XState deferred to Phase 6 if complexity warrants.

4. **Streaming Responses**: Deferred to Phase 6 optimization. Phase 2 uses standard request/response.

5. **Conversation Summarization**: Out of scope. Research indicates typical sessions stay under token limit.

---

## Design Overview

### Conversation Flow (Gathering Phase Only)

```
User clicks "What's for dinner?"
  → ConversationPage mounts → IPC: conversation:start
  → Session created with state='gathering'
  → AI generates opening question via conversation-service
  → User responds → IPC: conversation:sendMessage
  → conversation-service.processConversationTurn:
      1. Fetch dietary profile (hardRestrictions)
      2. Build prompt with system context + message history
      3. Call OpenAI with structured output schema
      4. Parse AI response: { aiMessage, extractedContext, shouldTransition }
      5. Update session.userContext with extracted fields
      6. If shouldTransition=true, update session.state='suggesting'
      7. Return AI message to renderer
  → Renderer displays AI message
  → Loop until state transitions to 'suggesting'
```

### State Transition Logic

- **gathering → suggesting**: Triggered when `extractedContext` includes at minimum `energyLevel` AND `availableTime`. AI sets `shouldTransition=true` in structured output.

- **Decision Point**: AI is responsible for determining when enough context is gathered. This keeps transition logic declarative in AI response, not hard-coded in service.

### Prompt Strategy

**System Prompt** (from `prompts.ts`):

- Role: "Supportive recipe advisor helping decide what to cook"
- Tone: Warm, encouraging, not interrogative
- Constraints: User's dietary restrictions (fetched from dietary profile)
- Task: Gather energy level, available time, mood, shopping capability
- Output: Structured JSON with conversational message + extracted context

**User Prompt** (from `prompts.ts`):

- Includes last 5 messages for context
- Includes current userContext fields (if partially filled)
- Example: "User has said they're tired (energyLevel=low). Ask about available time next."

### Structured Output Schema

```typescript
const ConversationTurnSchema = z.object({
  aiMessage: z.string(), // Display to user
  extractedContext: z.object({
    energyLevel: z.enum(['low', 'medium', 'high']).optional(),
    availableTime: z.number().min(0).max(120).optional(),
    mood: z.string().optional(),
    canShop: z.boolean().optional(),
  }),
  shouldTransition: z.boolean(), // Whether to move to 'suggesting' state
  reasoning: z.string().optional(), // For debugging/logging
});
```

**Note**: `aiMessage` is natural language for user. `extractedContext` is structured data for session state. AI provides both simultaneously.

---

## Implementation Instructions (For Implementor)

### PLAN-001: Create Conversation Schema (Zod)

**Change Type**: create  
**File**: `src/main/conversation/conversation-schema.ts`

**Instruction**:

1. Create new file `src/main/conversation/conversation-schema.ts`.
2. Import `{ z }` from `'zod'`.
3. Define `ConversationTurnSchema` with the following structure:
   - `aiMessage`: `z.string()` — Conversational text to display to user
   - `extractedContext`: `z.object()` with optional fields:
     - `energyLevel`: `z.enum(['low', 'medium', 'high']).optional()`
     - `availableTime`: `z.number().min(0).max(120).optional()` — Minutes
     - `mood`: `z.string().optional()` — Free-text mood description
     - `canShop`: `z.boolean().optional()` — Whether user can go shopping
   - `shouldTransition`: `z.boolean()` — Whether to transition from 'gathering' to 'suggesting'
   - `reasoning`: `z.string().optional()` — AI's internal reasoning for debugging
4. Export the schema as `ConversationTurnSchema`.
5. Export TypeScript type `export type ConversationTurnOutput = z.infer<typeof ConversationTurnSchema>;`.

**Evidence**: Existing pattern at `src/main/ai/recipe-schema.ts` (Zod schema for structured outputs).

**Done When**:

- File compiles without TypeScript errors (`npm run typecheck`).
- Schema matches the structure defined above.
- Type `ConversationTurnOutput` is exported for use in conversation-service.

---

### PLAN-002: Create Prompts Module

**Change Type**: create  
**File**: `src/main/conversation/prompts.ts`

**Instruction**:

1. Create new file `src/main/conversation/prompts.ts`.
2. Import types: `ConversationSession`, `ConversationMessage`, `DietaryProfile`.
3. Define `GATHERING_SYSTEM_PROMPT` (string constant):
   - Role: "You are a friendly, supportive recipe advisor..."
   - Tone: Warm, encouraging, one question at a time
   - Task: Gather energyLevel, availableTime, mood, canShop through natural questions
   - Constraints: "User has dietary restrictions: {dietaryRestrictions} — NEVER violate these"
   - Output format: "Respond with JSON matching ConversationTurnSchema"
   - Example conversational flow (few-shot):
     - Opening: "How's your energy level tonight? Feeling up for some cooking or need something really simple?"
     - Follow-up: "Got it! About how much time do you have? 30 minutes? 45?"
4. Define function `buildConversationPrompt(session: ConversationSession, dietaryProfile: DietaryProfile): string`:
   - Include last 5 messages from `session.messages`
   - Include current `session.userContext` (show what's already captured)
   - Include dietary restrictions from `dietaryProfile.hardRestrictions`
   - Format: "# Conversation History\n{messages}\n\n# User Context So Far\n{context}\n\n# User's Latest Message\n{lastMessage}"
5. Export both `GATHERING_SYSTEM_PROMPT` and `buildConversationPrompt`.

**Pseudocode**:

```typescript
export const GATHERING_SYSTEM_PROMPT = `You are a friendly, supportive recipe advisor...

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

# Output Format
Respond with JSON matching ConversationTurnSchema:
- aiMessage: Your conversational question/response
- extractedContext: Structured fields extracted from user's response
- shouldTransition: true if you have energyLevel AND availableTime, false otherwise

# Example
User: "Pretty tired tonight"
Response: {
  "aiMessage": "I hear you! Let's find something easy. About how much time do you have? 30 minutes? 45?",
  "extractedContext": { "energyLevel": "low" },
  "shouldTransition": false
}`;

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
```

**Evidence**: Research recommendation for prompting strategy (lines 230-298).

**Done When**:

- `GATHERING_SYSTEM_PROMPT` includes supportive tone, task description, constraints, and output format.
- `buildConversationPrompt` correctly formats conversation history and context.
- File compiles without TypeScript errors.

---

### PLAN-003: Create Conversation Service

**Change Type**: create  
**File**: `src/main/conversation/conversation-service.ts`

**Instruction**:

1. Create new file `src/main/conversation/conversation-service.ts`.
2. Import dependencies:
   - `OpenAI` from `'openai'`
   - `zodResponseFormat` from `'openai/helpers/zod'`
   - `getSession, updateSessionMessages` from `'./session-manager.js'`
   - `getDietaryProfile` from `'../database/dal/dietary-profile.js'`
   - `GATHERING_SYSTEM_PROMPT, buildConversationPrompt` from `'./prompts.js'`
   - `ConversationTurnSchema, ConversationTurnOutput` from `'./conversation-schema.js'`
3. Create `getOpenAIClient()` function (lazy initialization pattern):
   - Same as `recipe-generator.ts:17-31`
   - Check `process.env.OPENAI_API_KEY`, throw if missing
   - Initialize with `timeout: 30000, maxRetries: 2`
4. Create `processConversationTurn(sessionId: string, userMessage: string): Promise<ConversationTurnOutput>`:
   - Step 1: Fetch session via `getSession(sessionId)`. Throw if null.
   - Step 2: Add user message to session via `updateSessionMessages(sessionId, { role: 'user', content: userMessage, timestamp: new Date() })`.
   - Step 3: Fetch dietary profile via `getDietaryProfile()`.
   - Step 4: Build prompt via `buildConversationPrompt(session, dietaryProfile)`.
   - Step 5: Call OpenAI API:
     - Model: `'gpt-4o-mini'`
     - Messages: `[{ role: 'system', content: GATHERING_SYSTEM_PROMPT }, { role: 'user', content: prompt }]`
     - `response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn')`
     - `temperature: 0.7` (slightly lower than recipe generation for consistency)
     - `max_tokens: 500` (shorter than recipe generation)
   - Step 6: Extract `completion.choices[0]?.message.parsed`. Throw if null.
   - Step 7: Add AI message to session via `updateSessionMessages(sessionId, { role: 'assistant', content: parsed.aiMessage, timestamp: new Date() })`.
   - Step 8: Return `parsed` (ConversationTurnOutput).
5. Add error handling:
   - Try-catch around OpenAI API call.
   - If error, return fallback: `{ aiMessage: "Sorry, I'm having trouble right now. Let's move forward with default settings.", extractedContext: {}, shouldTransition: true, reasoning: "AI service unavailable" }`.
   - Log error for debugging.

**Pseudocode**:

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getSession, updateSessionMessages } from './session-manager.js';
import { getDietaryProfile } from '../database/dal/dietary-profile.js';
import { GATHERING_SYSTEM_PROMPT, buildConversationPrompt } from './prompts.js';
import { ConversationTurnSchema, type ConversationTurnOutput } from './conversation-schema.js';
import type { ConversationMessage } from '../../shared/types/conversation.js';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please add your API key to the .env file.'
      );
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return openai;
}

export async function processConversationTurn(
  sessionId: string,
  userMessage: string
): Promise<ConversationTurnOutput> {
  // Step 1: Fetch session
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Step 2: Add user message to session
  const userMsg: ConversationMessage = {
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  };
  updateSessionMessages(sessionId, userMsg);

  try {
    // Step 3: Fetch dietary profile
    const dietaryProfile = await getDietaryProfile();

    // Step 4: Build prompt
    const userPrompt = buildConversationPrompt(session, dietaryProfile);

    // Step 5: Call OpenAI
    const client = getOpenAIClient();
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: GATHERING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
      temperature: 0.7,
      max_tokens: 500,
    });

    // Step 6: Extract parsed response
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) throw new Error('Failed to parse AI response');

    // Step 7: Add AI message to session
    const aiMsg: ConversationMessage = {
      role: 'assistant',
      content: parsed.aiMessage,
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, aiMsg);

    // Step 8: Return parsed output
    return parsed;
  } catch (error) {
    console.error('Conversation AI error:', error);

    // Fallback: Skip to suggesting with default context
    const fallbackMsg: ConversationMessage = {
      role: 'assistant',
      content: "I'm having trouble connecting right now. Let's see what recipes we have!",
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, fallbackMsg);

    return {
      aiMessage: fallbackMsg.content,
      extractedContext: {},
      shouldTransition: true, // Skip gathering, go to suggesting
      reasoning: 'AI service unavailable - fallback mode',
    };
  }
}
```

**Evidence**: OpenAI client pattern at `src/main/ai/recipe-generator.ts:17-31`, structured output at `recipe-generator.ts:126-135`.

**Done When**:

- Function compiles without TypeScript errors.
- Function follows existing OpenAI pattern (lazy client, structured output, error handling).
- Fallback logic ensures conversation continues even if AI fails.

---

### PLAN-004: Update Session Manager with State and Context Updates

**Change Type**: modify  
**File**: `src/main/conversation/session-manager.ts`

**Instruction**:

1. Open `src/main/conversation/session-manager.ts`.
2. Add new function `updateSessionState(sessionId: string, newState: ConversationState): void`:
   - Fetch session from `activeSessions.get(sessionId)`.
   - Throw if session not found.
   - Update `session.state = newState`.
   - Update `session.lastActivity = new Date()`.
3. Add new function `updateUserContext(sessionId: string, contextUpdates: Partial<UserContext>): void`:
   - Fetch session from `activeSessions.get(sessionId)`.
   - Throw if session not found.
   - Merge `contextUpdates` into `session.userContext` using object spread.
   - Update `session.lastActivity = new Date()`.
4. Export both new functions.

**Pseudocode**:

```typescript
export function updateSessionState(sessionId: string, newState: ConversationState): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.state = newState;
  session.lastActivity = new Date();
}

export function updateUserContext(sessionId: string, contextUpdates: Partial<UserContext>): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.userContext = { ...session.userContext, ...contextUpdates };
  session.lastActivity = new Date();
}
```

**Evidence**: Existing pattern in `session-manager.ts:51-58` (updateSessionMessages follows same validation pattern).

**Done When**:

- Both functions compile without TypeScript errors.
- Functions follow existing session manager patterns (validation, timestamp updates).
- Functions are exported for use in conversation-handlers.

---

### PLAN-005: Update IPC Handlers to Use Conversation Service

**Change Type**: modify  
**File**: `src/main/ipc/conversation-handlers.ts`

**Instruction**:

1. Open `src/main/ipc/conversation-handlers.ts`.
2. Import `processConversationTurn` from `'../conversation/conversation-service.js'`.
3. Import `updateSessionState, updateUserContext` from `'../conversation/session-manager.js'`.
4. In `conversation:sendMessage` handler (lines 38-69):
   - **Replace lines 56-62** (echo logic) with:

     ```typescript
     // Phase 2: AI-powered conversation
     const turnResult = await processConversationTurn(sessionId, message);

     // Update session context if AI extracted new information
     if (Object.keys(turnResult.extractedContext).length > 0) {
       updateUserContext(sessionId, turnResult.extractedContext);
     }

     // Transition state if AI indicates readiness
     if (turnResult.shouldTransition) {
       updateSessionState(sessionId, 'suggesting');
     }

     return {
       success: true,
       aiMessage: turnResult.aiMessage,
       timestamp: new Date(),
     };
     ```

   - **Remove** old echo logic (lines 56-62).
5. Add try-catch around `processConversationTurn` call:
   - If error, return `{ success: false, error: error.message }`.

**Evidence**: Existing IPC handler structure at `src/main/ipc/conversation-handlers.ts:38-69`.

**Done When**:

- Echo logic is removed.
- Conversation service is called instead.
- User context and state updates are applied based on AI response.
- Error handling ensures IPC doesn't crash on AI failure.
- File compiles without TypeScript errors.

---

### PLAN-006: Add Unit Tests for Conversation Service

**Change Type**: create  
**File**: `src/main/conversation/conversation-service.test.ts`

**Instruction**:

1. Create new file `src/main/conversation/conversation-service.test.ts`.
2. Import test utilities: `describe, it, expect, vi, beforeEach, afterEach` from `'vitest'`.
3. Mock OpenAI module:
   - `vi.mock('openai', () => ({ default: vi.fn() }))`.
4. Mock session-manager:
   - `vi.mock('./session-manager.js', () => ({ getSession: vi.fn(), updateSessionMessages: vi.fn() }))`.
5. Mock dietary-profile DAL:
   - `vi.mock('../database/dal/dietary-profile.js', () => ({ getDietaryProfile: vi.fn() }))`.
6. Write test suite `describe('processConversationTurn', () => { ... })`:
   - **Test 1**: "should extract energy level from user response"
     - Mock session with empty userContext.
     - Mock OpenAI response: `{ aiMessage: "Got it! How much time do you have?", extractedContext: { energyLevel: 'low' }, shouldTransition: false }`.
     - Call `processConversationTurn(sessionId, "I'm pretty tired")`.
     - Expect `result.extractedContext.energyLevel === 'low'`.
     - Expect `updateSessionMessages` called twice (user + AI).
   - **Test 2**: "should transition to suggesting when context complete"
     - Mock session with `userContext: { energyLevel: 'low' }`.
     - Mock OpenAI response: `{ aiMessage: "Perfect! Let me find some recipes.", extractedContext: { availableTime: 30 }, shouldTransition: true }`.
     - Call `processConversationTurn(sessionId, "About 30 minutes")`.
     - Expect `result.shouldTransition === true`.
   - **Test 3**: "should handle AI service failure gracefully"
     - Mock OpenAI to throw error.
     - Call `processConversationTurn(sessionId, "Hello")`.
     - Expect result with `shouldTransition: true` and fallback message.
     - Expect no exception thrown.
7. Write test suite `describe('buildConversationPrompt', () => { ... })`:
   - **Test 1**: "should include dietary restrictions in prompt"
     - Mock dietary profile with `hardRestrictions: ['gluten-free']`.
     - Mock session with empty messages.
     - Call `buildConversationPrompt(session, dietaryProfile)`.
     - Expect prompt to include "gluten-free".
   - **Test 2**: "should include last 5 messages in prompt"
     - Mock session with 7 messages.
     - Call `buildConversationPrompt(session, dietaryProfile)`.
     - Expect prompt to include only last 5 messages (not all 7).

**Evidence**: Existing test pattern at `src/main/ai/recipe-generator.test.ts`.

**Done When**:

- All tests pass (`npm test`).
- Mocks correctly simulate OpenAI responses.
- Tests cover happy path, context extraction, state transition, and error handling.

---

### PLAN-007: Add Integration Tests for Full Conversation Flow

**Change Type**: create  
**File**: `src/main/ipc/conversation-handlers.test.ts` (extend existing or create new suite)

**Instruction**:

1. Open or create `src/main/ipc/conversation-handlers.test.ts`.
2. Add new test suite: `describe('Conversation Flow (Phase 2)', () => { ... })`.
3. Mock OpenAI globally for these tests (use `vi.mock('openai')`).
4. Write integration test: "should gather context through multi-turn conversation"
   - **Setup**:
     - Start session via `conversation:start` IPC.
     - Mock OpenAI responses for 3 turns:
       - Turn 1: Extract energyLevel=low, shouldTransition=false
       - Turn 2: Extract availableTime=30, shouldTransition=false
       - Turn 3: Extract mood="comfort food", shouldTransition=true
   - **Execute**:
     - Send message 1: "I'm tired"
     - Verify: AI response, context updated with energyLevel=low, state still 'gathering'
     - Send message 2: "30 minutes"
     - Verify: AI response, context updated with availableTime=30, state still 'gathering'
     - Send message 3: "Want something comforting"
     - Verify: AI response, context updated with mood, state transitions to 'suggesting'
   - **Assert**:
     - Final session state is 'suggesting'.
     - Final userContext includes all three fields.
     - All messages stored in session.messages.
5. Write integration test: "should handle AI failure mid-conversation"
   - Start session.
   - Send first message successfully (mocked OpenAI works).
   - Send second message with OpenAI throwing error.
   - Verify: Fallback message returned, state transitions to 'suggesting', no crash.

**Evidence**: Existing IPC handler test pattern (if exists) or follow vitest conventions.

**Done When**:

- Integration tests pass.
- Multi-turn conversation flow verified.
- Error handling during conversation verified.

---

## Acceptance Criteria

Phase 2 is complete when ALL of the following are verified:

### Functional Criteria

- [ ] System asks opening question when conversation starts (e.g., "How's your energy level?")
- [ ] User can respond with free text (e.g., "I'm pretty tired")
- [ ] System adapts follow-up question based on response (e.g., "Got it! How much time do you have?")
- [ ] User context captured in session state:
  - [ ] `energyLevel` ('low' | 'medium' | 'high')
  - [ ] `availableTime` (number, in minutes)
  - [ ] `mood` (string, optional)
  - [ ] `canShop` (boolean, optional)
- [ ] Conversation state transitions from 'gathering' to 'suggesting' when context is sufficient
- [ ] Dietary restrictions from dietary profile are included in AI prompts

### Technical Criteria

- [ ] AI response time <5 seconds per turn (measured in manual testing)
- [ ] Conversation service uses structured output (Zod schema) for reliable context extraction
- [ ] Session manager correctly updates state and userContext
- [ ] IPC handler replaces echo mode with conversation service
- [ ] Error handling: AI service failure results in graceful fallback, not crash

### Quality Criteria

- [ ] Unit tests pass for conversation service (`npm test`)
- [ ] Integration tests pass for multi-turn conversation flow
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes without errors (`npm run lint`)
- [ ] Manual testing confirms supportive, natural tone in AI responses

---

## Verification Steps

### After Each Task

```bash
npm run typecheck        # Verify TypeScript compilation
npm run lint             # Verify code quality
npm test                 # Run unit tests
```

### After All Tasks

```bash
npm run build            # Verify build succeeds
npm test                 # All tests pass
npm run dev              # Launch app for manual testing
```

### Manual Testing Checklist

1. **Start Conversation**:
   - Click "What's for dinner?" button.
   - Verify conversation page loads.
   - Verify AI asks opening question (not echo).

2. **Multi-Turn Context Gathering**:
   - Respond: "I'm really tired tonight".
   - Verify: AI acknowledges and asks about time.
   - Respond: "Maybe 30 minutes".
   - Verify: AI acknowledges and asks about mood or shopping.
   - Respond: "Can't go shopping, need to use what I have".
   - Verify: AI confirms and transitions (state should change to 'suggesting' in console logs).

3. **Context Captured**:
   - Check browser console or backend logs.
   - Verify session.userContext includes:
     - `energyLevel: 'low'`
     - `availableTime: 30`
     - `canShop: false`

4. **Error Handling**:
   - Temporarily rename `.env` to disable OPENAI_API_KEY.
   - Start new conversation.
   - Verify: Fallback message appears, app doesn't crash.
   - Restore `.env`.

5. **Performance**:
   - Use browser DevTools Network tab.
   - Verify AI response time <5 seconds per turn.

---

## Architectural Decisions (Phase 2)

### Decision 1: Use Simple State Enum (Not XState)

**Decision**: Use simple `ConversationState` type enum for state transitions.

**Rationale**:

- State transitions are linear and straightforward for MVP: gathering → suggesting → refining → confirmed.
- `ConversationState` type already defined in `src/shared/types/conversation.ts:53`.
- XState adds dependency and learning curve without clear benefit at this stage.
- Research says "XState or simpler state enum" (Master Plan line 406), confirming this is valid.

**Deferred**: XState can be added in Phase 6 if conversation flow becomes complex (parallel states, history, nested states).

---

### Decision 2: Structured Output for Context Extraction

**Decision**: Use Zod schema with `chat.completions.parse()` to extract user context reliably.

**Rationale**:

- Free-form parsing (regex, keyword matching) is fragile and hard to debug.
- Structured output ensures type-safe extraction of energyLevel, availableTime, etc.
- Consistent with existing pattern in `recipe-generator.ts:126-135`.
- AI generates both conversational text (`aiMessage`) and structured data (`extractedContext`) in one call.

**Trade-off**: Slightly less natural than pure conversational AI, but reliability is critical for MVP.

---

### Decision 3: AI Determines State Transition

**Decision**: AI sets `shouldTransition` flag in structured output to indicate readiness to move from 'gathering' to 'suggesting'.

**Rationale**:

- Keeps transition logic declarative in AI response, not hard-coded in service.
- Allows AI to adapt (e.g., skip mood question if user is impatient).
- Simplifies service logic (no complex if/else for "is context sufficient?").

**Constraint**: AI must reliably set `shouldTransition=true` when at least `energyLevel` AND `availableTime` are captured.

---

### Decision 4: Fallback to Suggesting on AI Failure

**Decision**: If OpenAI API fails, skip context gathering and transition directly to 'suggesting' state with default/empty context.

**Rationale**:

- Graceful degradation ensures user can still use the app.
- Phase 3 will handle recipe filtering with whatever context is available (even if empty).
- Research recommendation: "graceful degradation to database filtering" (research lines 547-578).

**User Impact**: User sees message like "Let's see what recipes we have!" and proceeds without personalized context. Better than app crash.

---

## Testing Strategy

### Unit Tests (Vitest)

**Target**: `src/main/conversation/conversation-service.ts`, `src/main/conversation/prompts.ts`

**Approach**:

- Mock OpenAI responses for deterministic testing.
- Test context extraction logic (energyLevel, availableTime, mood, canShop).
- Test state transition logic (shouldTransition flag).
- Test error handling (AI failure → fallback response).

**Coverage Goal**: >90% code coverage for new files.

---

### Integration Tests (Vitest)

**Target**: `src/main/ipc/conversation-handlers.ts` (full flow)

**Approach**:

- Mock OpenAI at module level.
- Simulate multi-turn conversation (3-4 messages).
- Verify session state updates correctly after each turn.
- Verify userContext accumulates extracted fields.
- Verify state transition occurs when AI sets shouldTransition=true.

**Coverage Goal**: Full happy path + error scenario.

---

### Manual Testing

**Focus**: Tone, naturalness, response time.

**Checklist**:

- Conversation feels supportive, not interrogative.
- Questions adapt to user responses (not robotic script).
- Response time <5 seconds per turn.
- Context captured correctly in session (check logs).

**User Acceptance**: Qualitative assessment—does conversation feel helpful?

---

## Dependencies and Prerequisites

### Prerequisites (VERIFIED COMPLETE)

- [x] Phase 0: Data Foundation complete (cooking_sessions table exists)
- [x] Phase 1: Conversation Infrastructure complete (session manager, IPC, UI)
- [x] OpenAI API key configured in `.env` file
- [x] Dietary profile DAL exists (`src/main/database/dal/dietary-profile.ts`)

### External Dependencies (Already Installed)

- [x] `openai` v6.15.0 (from package.json)
- [x] `zod` (for schema validation)

### No New Dependencies Needed

All required libraries are already installed. Phase 2 extends existing patterns.

---

## Risk Register

### Risk 1: AI Responses Feel Robotic

**Impact**: High (core UX value lost)  
**Probability**: Medium  
**Mitigation**:

- Extensive prompt engineering with few-shot examples.
- Manual testing with diverse user inputs.
- Iterate on system prompt based on feedback.

---

### Risk 2: Context Extraction Fails (AI Doesn't Set Fields)

**Impact**: High (state transition blocked)  
**Probability**: Low (structured output enforces schema)  
**Mitigation**:

- Zod schema ensures fields exist (even if undefined/optional).
- Prompt explicitly instructs AI to fill `extractedContext`.
- Unit tests verify extraction logic with mocked responses.

---

### Risk 3: AI Latency Exceeds 5 Seconds

**Impact**: Medium (UX degradation)  
**Probability**: Low (research verified 2-3s typical)  
**Mitigation**:

- GPT-4o-mini is fast (research lines 76-89).
- Limit `max_tokens: 500` for conversational turns (vs. 2000 for recipe generation).
- If issue persists, implement optimistic UI updates in Phase 6.

---

## Next Steps

### For the Implementor

1. Read this plan in full.
2. Verify prerequisites (Phase 0, Phase 1 complete; OPENAI_API_KEY set).
3. Execute tasks PLAN-001 through PLAN-007 in sequence.
4. Run verification steps after each task.
5. Update STATE file after each task completion.
6. Notify Planner when all tasks complete for final verification.

### For the Planner

After Phase 2 completion:

- Verify acceptance criteria.
- Create Phase 3 detailed plan (Recipe Suggestion & Ranking).

---

## Appendix: Key References

### Codebase References (Verified with `read`)

- **OpenAI client pattern**: `src/main/ai/recipe-generator.ts:17-31`
- **Structured output usage**: `src/main/ai/recipe-generator.ts:126-135`
- **Session manager**: `src/main/conversation/session-manager.ts:18-33`
- **IPC handler pattern**: `src/main/ipc/conversation-handlers.ts:38-69`
- **ConversationSession type**: `src/shared/types/conversation.ts:75-88`
- **Dietary profile DAL**: `src/main/database/dal/dietary-profile.ts:6-27`

### Research References

- **Prompting strategy**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md:230-298`
- **Performance validation**: Research lines 76-89
- **Error handling pattern**: Research lines 547-578
- **State management**: Research lines 162-228

### Master Plan References

- **Phase 2 definition**: Lines 117-153
- **Acceptance criteria**: Lines 139-150
- **Architectural decisions**: Lines 391-410

---

**End of Phase 2 Plan**

**Status**: Ready for Implementation  
**Next Document**: `2026-01-06-Conversational-Decision-Support-Phase2-AI-Integration-STATE.md` (to be created by Implementor)
