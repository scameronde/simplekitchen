---
date: 2026-01-06
planner: assistant
phase: 4
epic-id: 'EPIC-002'
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
prerequisites:
  - 'Phase 0: Data Foundation (COMPLETE)'
  - 'Phase 1: Conversation Infrastructure (COMPLETE)'
  - 'Phase 2: AI Integration (COMPLETE)'
  - 'Phase 3: Recipe Suggestion & Ranking (COMPLETE)'
status: ready-for-implementation
type: detailed-phase-plan
---

# Phase 4: Feedback & Iterative Refinement

## Inputs

### Research Report

- **File**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
- **Relevant sections**:
  - Iterative Refinement Pattern (lines 302-329)
  - Conversation Quality Controls (lines 502-541)
  - Fallback Strategy (lines 545-578)

### Master Plan

- **File**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
- **Phase Definition**: Lines 199-233
- **Acceptance Criteria**: Lines 349-385

### Verified Prerequisites (Phase 3)

- **State File**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase3-STATE.md`
- **Status**: All 13 tasks complete (lines 15-34)
- **Components Available**:
  - `session-manager.ts` with rejectedRecipes field
  - `recipe-ranker.ts` with AI ranking
  - `conversation-service.ts` with transitionToSuggesting
  - `RecipeSuggestionCard` component with onReject handler
  - `ConversationPage` with placeholder onReject implementation

---

## Verified Current State

### Fact 1: ConversationSession Has Rejection Tracking Field

- **Evidence**: `src/shared/types/conversation.ts:95-98`
- **Excerpt**:

```typescript
rejectedRecipes: Array<{
  recipeId: string;
  reason?: string;
}>;
```

- **Implication**: Type structure exists, but no session-manager function to add rejections

### Fact 2: Session Manager Lacks Rejection Functions

- **Evidence**: `src/main/conversation/session-manager.ts:1-136`
- **Excerpt**: File contains createSession, getSession, updateSessionMessages, updateSessionState, updateUserContext, updateSessionSuggestedRecipes, abandonSession, cleanupStaleSessions
- **Missing**: addRejectedRecipe function to populate rejectedRecipes array
- **Missing**: refinementCount and turnsInCurrentState tracking fields

### Fact 3: Recipe Ranker Excludes Already Suggested Recipes

- **Evidence**: `src/main/conversation/recipe-ranker.ts:54`
- **Excerpt**:

```typescript
const { userContext, suggestedRecipes } = session;
```

- **Implication**: Already filters suggestedRecipes but NOT rejectedRecipes yet (needs extension)

### Fact 4: Prompting Infrastructure Exists

- **Evidence**: `src/main/conversation/prompts.ts:1-247`
- **Excerpt**: Contains GATHERING_SYSTEM_PROMPT (lines 15-60), RANKING_SYSTEM_PROMPT (lines 67-139), buildConversationPrompt, buildRankingPrompt
- **Missing**: buildRefinementContext function to inject rejection patterns into prompts

### Fact 5: ConversationPage Has Placeholder Rejection Handler

- **Evidence**: `src/renderer/pages/ConversationPage.tsx:246-249`
- **Excerpt**:

```typescript
onReject={() => {
  // TODO: Phase 4/5 - Implement recipe rejection
  console.log('Recipe rejected:', recipe.id, recipe.title);
}}
```

- **Implication**: UI is wired, needs implementation

### Fact 6: IPC Handlers Follow Established Pattern

- **Evidence**: `src/main/ipc/conversation-handlers.ts:32-108`
- **Excerpt**: All handlers validate sender, check session, wrap in try-catch, return {success, ...} structure
- **Pattern**: conversation:start (lines 33-40), conversation:sendMessage (lines 42-77), conversation:abandon (lines 79-86), conversation:get-suggestions (lines 88-107)
- **Missing**: conversation:reject-recipe and conversation:refine handlers

### Fact 7: Conversation State Machine Includes 'refining'

- **Evidence**: `src/shared/types/conversation.ts:66`
- **Excerpt**:

```typescript
export type ConversationState = 'gathering' | 'suggesting' | 'refining' | 'confirmed' | 'abandoned';
```

- **Implication**: State already defined, just needs transition logic

---

## Goals / Non-Goals

### Goals

1. Enable user feedback on recipe suggestions with optional reasons
2. Track rejected recipes in session state to prevent re-suggesting
3. Incorporate rejection patterns into AI prompts for intelligent refinement
4. Implement refinement loop (suggesting → refining → suggesting)
5. Enforce maximum 3 refinement cycles with escalation strategy
6. Display refinement suggestions as new messages in conversation thread

### Non-Goals (Deferred)

- Advanced ingredient substitution engine (AI handles basic cases via prompts)
- Conversation summarization (sessions stay under token limit)
- Persistent rejection tracking across sessions (ephemeral session data only)
- Voice-based feedback collection (text-only MVP)
- Analytics or metrics on rejection patterns

---

## Design Overview

### User Workflow

1. User sees 2-4 recipe suggestions from Phase 3
2. User clicks "Not this one" button on RecipeSuggestionCard
3. Frontend displays FeedbackDialog modal with quick-reply reasons and optional free text
4. User selects reason ("Missing ingredient", "Not in the mood", "Too complex", "Other") or skips
5. Frontend calls `conversation:reject-recipe` IPC with recipeId and optional reason
6. Backend records rejection in session.rejectedRecipes
7. Frontend automatically calls `conversation:refine` IPC to fetch new suggestions
8. Backend:
   - Validates refinement count (max 3 cycles)
   - Builds refinement context with rejection patterns
   - Calls getRankedSuggestions with enhanced prompt
   - Excludes rejected recipes from candidates
9. AI returns 2-4 new suggestions OR suggests substitutions for missing ingredients
10. Frontend displays new suggestions as assistant message with recipe cards
11. Loop continues until user selects a recipe or abandons conversation

### State Transitions

- `suggesting` → `refining` (on first rejection)
- `refining` → `refining` (subsequent refinement cycles, max 3)
- `refining` → `suggesting` (if user wants to restart search)
- `refining` → `confirmed` (Phase 5 - user selects recipe)
- `refining` → `abandoned` (user closes without selecting)

### Data Flow

```
User clicks onReject(recipeId)
  → FeedbackDialog opens
  → User selects reason → handleRejectSubmit(recipeId, reason)
  → IPC: conversation:reject-recipe(sessionId, recipeId, reason)
  → Main: session-manager.addRejectedRecipe()
  → Frontend: IPC conversation:refine(sessionId)
  → Main: conversation-service.processRefinement()
  → Main: recipe-ranker.getRankedSuggestions() with exclusions + refinement context
  → AI: Ranks recipes considering rejection patterns
  → IPC: Returns { success, suggestions, aiMessage, isEscalation }
  → Renderer: Displays new suggestions in conversation thread
```

---

## Implementation Instructions (For Implementor)

### PLAN-001: Extend ConversationSession Type with Refinement Tracking

**Change Type**: modify  
**File**: `src/shared/types/conversation.ts`  
**Instruction**: Add refinementCount and turnsInCurrentState fields to ConversationSession interface

**Current State (Evidence)**: `src/shared/types/conversation.ts:90-103`

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

**Modification Required**:
Add two new fields after `turnCount`:

```typescript
turnCount: number; // Track conversation length
refinementCount: number; // Track refinement cycles (max 3)
turnsInCurrentState: number; // Track turns in current state (for escalation)
```

**Reasoning**: Master plan lines 508-512 specify turn limits (5 per state) and refinement caps (3 cycles). These fields enable enforcement of quality controls.

**Done When**:

- [ ] refinementCount field added to ConversationSession interface
- [ ] turnsInCurrentState field added to ConversationSession interface
- [ ] Type checking passes (`npm run typecheck`)
- [ ] No other files reference undefined fields (session-manager must initialize these)

---

### PLAN-002: Add Rejection Tracking to Session Manager

**Change Type**: modify  
**File**: `src/main/conversation/session-manager.ts`  
**Instruction**: Add addRejectedRecipe function and update createSession to initialize new fields

**Current State (Evidence)**: `src/main/conversation/session-manager.ts:23-38`

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

**Modification 1**: Update createSession initialization (after line 32)

```typescript
state: 'gathering',
turnCount: 0,
refinementCount: 0,
turnsInCurrentState: 0,
createdAt: new Date(),
```

**Modification 2**: Add new function after updateSessionSuggestedRecipes (after line 110)

```typescript
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
```

**Modification 3**: Update updateSessionState to reset turnsInCurrentState (modify existing function at line 72)
Add this line after `session.state = newState;` (line 76):

```typescript
session.state = newState;
session.turnsInCurrentState = 0; // Reset turn counter on state transition
session.lastActivity = new Date();
```

**Modification 4**: Update updateSessionMessages to increment turnsInCurrentState (modify existing function at line 56)
Add this line after `session.turnCount += 1;` (line 61):

```typescript
session.turnCount += 1;
session.turnsInCurrentState += 1;
session.lastActivity = new Date();
```

**Evidence for Pattern**: Existing functions (updateUserContext, updateSessionSuggestedRecipes) follow same pattern: get session, validate, update, set lastActivity

**Done When**:

- [ ] addRejectedRecipe function added and exported
- [ ] createSession initializes refinementCount and turnsInCurrentState to 0
- [ ] updateSessionState resets turnsInCurrentState on state change
- [ ] updateSessionMessages increments turnsInCurrentState
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-003: Add Refinement Context Builder to Prompts

**Change Type**: modify  
**File**: `src/main/conversation/prompts.ts`  
**Instruction**: Add buildRefinementContext function to inject rejection patterns into ranking prompts

**Current State (Evidence)**: `src/main/conversation/prompts.ts:179-246` shows buildRankingPrompt structure with alreadySuggested section at lines 210-215

**Modification**: Add new exported function at end of file (after line 246)

```typescript
/**
 * Build refinement context for AI prompt that includes rejection patterns.
 * Analyzes rejected recipes to identify patterns (e.g., all pasta rejected)
 * and provides instructions for refinement.
 *
 * @param session - Current conversation session with rejection history
 * @param candidates - Array of candidate recipes to check for pattern matching
 * @returns Formatted refinement context string to inject into ranking prompt
 */
export function buildRefinementContext(session: ConversationSession, candidates: Recipe[]): string {
  if (session.rejectedRecipes.length === 0) {
    return ''; // No refinement context needed
  }

  let context = `# Previously Rejected Recipes\n`;
  context += `The user has rejected the following recipes in this session. DO NOT suggest these recipes again:\n\n`;

  // List rejected recipes with reasons
  session.rejectedRecipes.forEach(rejection => {
    const rejectedRecipe = candidates.find(r => r.id === rejection.recipeId);
    const title = rejectedRecipe?.title || `Recipe ${rejection.recipeId}`;
    context += `- "${title}" (ID: ${rejection.recipeId})`;
    if (rejection.reason) {
      context += ` - Reason: ${rejection.reason}`;
    }
    context += '\n';
  });

  context += '\n# Refinement Instructions\n';

  // Identify patterns in rejections
  const reasons = session.rejectedRecipes
    .map(r => r.reason)
    .filter((r): r is string => r !== undefined);

  if (reasons.length > 0) {
    context += 'The user provided the following feedback:\n';
    reasons.forEach(reason => {
      context += `- ${reason}\n`;
    });
    context += '\n';
  }

  // Pattern detection hints
  const rejectedTitles = session.rejectedRecipes
    .map(r => candidates.find(c => c.id === r.recipeId)?.title || '')
    .filter(t => t !== '');

  // Check for common ingredient patterns
  const commonWords = ['pasta', 'chicken', 'beef', 'fish', 'rice', 'salad'];
  const rejectedPatterns: string[] = [];

  commonWords.forEach(word => {
    const matchCount = rejectedTitles.filter(title => title.toLowerCase().includes(word)).length;
    if (matchCount >= 2) {
      rejectedPatterns.push(word);
    }
  });

  if (rejectedPatterns.length > 0) {
    context += `**Pattern Detected**: The user rejected multiple recipes featuring: ${rejectedPatterns.join(', ')}. Avoid suggesting similar recipes.\n\n`;
  }

  // Refinement strategy based on rejection count
  if (session.refinementCount === 1) {
    context += `**Strategy**: This is the first refinement. Focus on addressing the specific rejection reasons while staying within the user's context (energy, time, mood).\n`;
  } else if (session.refinementCount === 2) {
    context += `**Strategy**: This is the second refinement. The user is being selective. Try a different approach - consider different cuisines, cooking methods, or ingredient combinations.\n`;
  } else if (session.refinementCount >= 3) {
    context += `**Strategy**: This is the third+ refinement. The user may need help. If you cannot find good matches, acknowledge the difficulty and suggest broadening constraints or trying a different approach.\n`;
  }

  context += '\n';

  return context;
}
```

**Modification to buildRankingPrompt**: Insert refinement context after alreadySuggested section (after line 215)

Change the function signature to accept session:

```typescript
export function buildRankingPrompt(
  userContext: UserContext,
  candidates: Recipe[],
  dietaryProfile: DietaryProfile,
  alreadySuggested: string[],
  session?: ConversationSession  // Add optional session parameter
): string {
```

Then add refinement context injection after line 215:

```typescript
if (alreadySuggested.length > 0) {
  prompt += `# Already Suggested in This Session\n`;
  prompt += `The following recipe IDs have already been shown to the user in this session. Deprioritize them unless they are exceptionally good matches:\n`;
  prompt += alreadySuggested.map(id => `- ${id}`).join('\n');
  prompt += '\n\n';
}

// Add refinement context if session provided
if (session && session.rejectedRecipes.length > 0) {
  const refinementContext = buildRefinementContext(session, candidates);
  prompt += refinementContext;
}

// Build candidate recipes section as JSON
prompt += `# Candidate Recipes\n`;
```

**Evidence for Pattern**: Research lines 302-329 show the refinement context pattern with rejection list, pattern identification, and refinement instructions

**Done When**:

- [ ] buildRefinementContext function added and exported
- [ ] buildRankingPrompt signature updated with optional session parameter
- [ ] Refinement context injected into ranking prompt when session provided
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-004: Extend Recipe Ranker to Exclude Rejected Recipes

**Change Type**: modify  
**File**: `src/main/conversation/recipe-ranker.ts`  
**Instruction**: Modify getRankedSuggestions to filter out rejectedRecipes and pass session to buildRankingPrompt

**Current State (Evidence)**: `src/main/conversation/recipe-ranker.ts:46-107`

- Line 54: `const { userContext, suggestedRecipes } = session;`
- Lines 67-75: Database query with filter
- Lines 80-87: buildRankingPrompt call

**Modification 1**: Extract rejectedRecipes (line 54)

```typescript
// Step 2: Extract context and already suggested recipes
const { userContext, suggestedRecipes, rejectedRecipes } = session;
```

**Modification 2**: Filter out rejected recipes from candidates (after line 68, before line 71)

```typescript
// Step 5: Query recipes with filter
const candidates = await getRecipes(filter);

// Step 5.5: Filter out rejected recipes
const rejectedIds = rejectedRecipes.map(r => r.recipeId);
const candidatesWithoutRejected = candidates.filter(recipe => !rejectedIds.includes(recipe.id));

// Step 6: Validate candidate count
if (candidatesWithoutRejected.length < 2) {
  throw new Error(
    `Insufficient recipes found after filtering rejections. Need at least 2 recipes but found ${candidatesWithoutRejected.length}. Consider relaxing constraints or restarting conversation.`
  );
}

// Step 7: Limit to 20 candidates max
const limitedCandidates = candidatesWithoutRejected.slice(0, 20);
```

**Modification 3**: Pass session to buildRankingPrompt (line 82-87)

```typescript
// Step 8: Call OpenAI with ranking prompt
const client = getOpenAIClient();
const prompt = buildRankingPrompt(
  userContext,
  limitedCandidates,
  dietaryProfile,
  suggestedRecipes,
  session // Pass session for refinement context
);
```

**Evidence**: This ensures rejected recipes are excluded from both the database results AND the AI prompt, preventing re-suggestion

**Done When**:

- [ ] rejectedRecipes extracted from session
- [ ] Rejected recipe IDs filtered out from candidates
- [ ] Error message updated to mention rejection filtering
- [ ] Session passed to buildRankingPrompt
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-005: Add Refinement Logic to Conversation Service

**Change Type**: modify  
**File**: `src/main/conversation/conversation-service.ts`  
**Instruction**: Add processRefinement function to handle refinement workflow with max cycle enforcement

**Current State (Evidence)**: `src/main/conversation/conversation-service.ts:133-180` shows transitionToSuggesting pattern

**Modification**: Add new exported function at end of file (after line 180)

```typescript
/**
 * Processes a refinement cycle for recipe suggestions.
 * Validates refinement count (max 3), transitions state to 'refining',
 * and fetches new ranked suggestions excluding rejected recipes.
 *
 * @param sessionId - The session ID to refine
 * @returns Result with new suggestions and AI message, or escalation notice
 */
export async function processRefinement(sessionId: string): Promise<SuggestionResult> {
  try {
    // Step 1: Get session
    const session = getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Step 2: Validate current state (must be in suggesting or refining)
    if (session.state !== 'suggesting' && session.state !== 'refining') {
      throw new Error(
        `Cannot refine from state '${session.state}'. Must be in 'suggesting' or 'refining' state.`
      );
    }

    // Step 3: Check refinement count (max 3 cycles)
    if (session.refinementCount > 3) {
      // Escalation: Too many refinements
      const escalationMessage = `I notice we've tried several options together. Let me suggest a different approach:

1. **Browse by category**: Would you like to see all quick dinners, or explore a specific cuisine?
2. **Relax constraints**: We could look at recipes up to ${(session.userContext.availableTime || 30) + 15} minutes, or try a different cooking method.
3. **Start fresh**: Want to tell me more about what you're craving, and we'll approach this differently?

What sounds best to you?`;

      // Add escalation message to session
      updateSessionMessages(sessionId, {
        role: 'assistant',
        content: escalationMessage,
        timestamp: new Date(),
      });

      return {
        success: true,
        aiMessage: escalationMessage,
        suggestions: undefined, // No suggestions, just escalation message
      };
    }

    // Step 4: Verify required context still exists
    if (
      session.userContext.energyLevel === undefined ||
      session.userContext.availableTime === undefined
    ) {
      throw new Error('Missing required context (energyLevel and availableTime)');
    }

    // Step 5: Update session state to refining (if not already)
    if (session.state !== 'refining') {
      updateSessionState(sessionId, 'refining');
    }

    // Step 6: Get new ranked suggestions (recipe-ranker now excludes rejected recipes)
    const result = await getRankedSuggestions(sessionId);

    // Step 7: Extract recipe IDs
    const recipeIds = result.suggestions.map(suggestion => suggestion.recipeId);

    // Step 8: Update session with suggested recipes
    updateSessionSuggestedRecipes(sessionId, recipeIds);

    // Step 9: Build AI message acknowledging refinement
    let aiMessage = '';
    if (session.refinementCount === 1) {
      aiMessage = 'Got it! Let me find some different options for you:';
    } else if (session.refinementCount === 2) {
      aiMessage = "No problem! Let's try a different approach with these recipes:";
    } else {
      aiMessage = "I'm determined to find the right recipe for you. How about these:";
    }

    // Step 10: Add AI message to session
    updateSessionMessages(sessionId, {
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date(),
    });

    // Step 11: Return success result
    return {
      success: true,
      suggestions: result,
      aiMessage,
    };
  } catch (error) {
    // Log error for debugging
    console.error('Error in processRefinement:', error);

    // Return error result
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Evidence for Pattern**: Follows same structure as transitionToSuggesting (lines 133-180): validate session, check state, update state, call ranking, update session, return result

**Reasoning**: Master plan lines 508-512 specify max 3 refinement cycles before escalation. This function enforces that limit and provides user-friendly escalation message.

**Done When**:

- [ ] processRefinement function added and exported
- [ ] Refinement count validation (max 3) enforced
- [ ] Escalation message displayed after 3 refinements
- [ ] State transitions to 'refining'
- [ ] New suggestions fetched via getRankedSuggestions
- [ ] AI message added to session history
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-006: Add IPC Handlers for Rejection and Refinement

**Change Type**: modify  
**File**: `src/main/ipc/conversation-handlers.ts`  
**Instruction**: Add conversation:reject-recipe and conversation:refine IPC handlers

**Current State (Evidence)**: `src/main/ipc/conversation-handlers.ts:32-108` shows existing handler pattern

**Modification 1**: Import new functions (after line 8)

```typescript
import {
  createSession,
  getSession,
  updateSessionState,
  updateUserContext,
  abandonSession,
  addRejectedRecipe, // Add this import
} from '../conversation/session-manager.js';
import {
  processConversationTurn,
  transitionToSuggesting,
  processRefinement, // Add this import
} from '../conversation/conversation-service.js';
```

**Modification 2**: Add conversation:reject-recipe handler (before conversation:abandon, after line 77)

```typescript
ipcMain.handle(
  'conversation:reject-recipe',
  async (event, sessionId: string, recipeId: string, reason?: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      addRejectedRecipe(sessionId, recipeId, reason);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
);

ipcMain.handle('conversation:refine', async (event, sessionId: string) => {
  if (!event.senderFrame || !validateSender(event.senderFrame)) {
    return { success: false, error: 'Unauthorized IPC sender' };
  }

  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const result = await processRefinement(sessionId);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});
```

**Evidence for Pattern**: Both handlers follow exact same structure as conversation:get-suggestions (lines 88-107): validate sender, validate session, try-catch wrapper, return structured result

**Done When**:

- [ ] addRejectedRecipe imported from session-manager
- [ ] processRefinement imported from conversation-service
- [ ] conversation:reject-recipe handler added
- [ ] conversation:refine handler added
- [ ] Both handlers follow security validation pattern
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-007: Extend Shared Types for IPC Contract

**Change Type**: modify  
**File**: `src/shared/types/electron.d.ts`  
**Instruction**: Add conversationAPI methods for reject-recipe and refine

**Current State**: Need to read electron.d.ts to see existing conversationAPI structure

**Modification**: Add to conversationAPI interface:

```typescript
conversationAPI: {
  startSession(): Promise<{ success: boolean; sessionId?: string; error?: string }>;
  sendMessage(
    sessionId: string,
    message: string
  ): Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }>;
  getSuggestions(sessionId: string): Promise<SuggestionResult>;
  rejectRecipe(
    sessionId: string,
    recipeId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }>;  // Add this
  refine(sessionId: string): Promise<SuggestionResult>;  // Add this
  abandonSession(sessionId: string): Promise<{ success: boolean; error?: string }>;
};
```

**Evidence**: Follows same pattern as existing conversationAPI methods with {success, error} structure

**Done When**:

- [ ] rejectRecipe method added to conversationAPI
- [ ] refine method added to conversationAPI
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-008: Update Preload Script with IPC Bindings

**Change Type**: modify  
**File**: `src/main/preload.ts`  
**Instruction**: Add IPC bindings for conversation:reject-recipe and conversation:refine

**Current State**: Need to read preload.ts to see existing conversationAPI structure

**Modification**: Add to conversationAPI object:

```typescript
conversationAPI: {
  startSession: () => ipcRenderer.invoke('conversation:start'),
  sendMessage: (sessionId: string, message: string) =>
    ipcRenderer.invoke('conversation:sendMessage', sessionId, message),
  getSuggestions: (sessionId: string) =>
    ipcRenderer.invoke('conversation:get-suggestions', sessionId),
  rejectRecipe: (sessionId: string, recipeId: string, reason?: string) =>
    ipcRenderer.invoke('conversation:reject-recipe', sessionId, recipeId, reason),
  refine: (sessionId: string) =>
    ipcRenderer.invoke('conversation:refine', sessionId),
  abandonSession: (sessionId: string) =>
    ipcRenderer.invoke('conversation:abandon', sessionId),
},
```

**Evidence**: Same pattern as existing IPC bindings

**Done When**:

- [ ] rejectRecipe binding added
- [ ] refine binding added
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-009: Create FeedbackDialog Component

**Change Type**: create  
**File**: `src/renderer/components/Conversation/FeedbackDialog.tsx`  
**Instruction**: Create modal component for collecting rejection feedback with quick-reply buttons

**Pseudocode/Interface**:

```typescript
import React, { useState } from 'react';

interface FeedbackDialogProps {
  isOpen: boolean;
  recipeName: string;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
}

export function FeedbackDialog({ isOpen, recipeName, onClose, onSubmit }: FeedbackDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  // Quick-reply reasons
  const quickReasons = [
    'Missing ingredient',
    'Not in the mood',
    'Too complex',
    'Takes too long',
    'Other',
  ];

  const handleSubmit = () => {
    const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
    onSubmit(finalReason || undefined);
    handleClose();
  };

  const handleSkip = () => {
    onSubmit(undefined); // No reason provided
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">
          Why not "{recipeName}"?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          This helps me find better suggestions for you. (Optional)
        </p>

        {/* Quick-reply buttons */}
        <div className="space-y-2 mb-4">
          {quickReasons.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full px-4 py-2 rounded-lg border-2 text-left transition ${
                selectedReason === reason
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Custom reason input (show if "Other" selected) */}
        {selectedReason === 'Other' && (
          <div className="mb-4">
            <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Please specify:
            </label>
            <input
              id="custom-reason"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Don't like mushrooms"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedReason === 'Other' && !customReason.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Design Notes**:

- Modal overlay with dark backdrop (z-50 to appear above conversation)
- Quick-reply buttons for common reasons (research lines 333-334)
- Optional custom text input when "Other" selected
- Skip button allows rejection without reason
- Submit button disabled if "Other" selected but no text entered
- Accessibility: Focus trap, escape key to close (add in testing phase)

**Done When**:

- [ ] FeedbackDialog component created with all UI elements
- [ ] Quick-reply buttons render and update selectedReason state
- [ ] Custom reason input appears when "Other" selected
- [ ] Skip button calls onSubmit(undefined)
- [ ] Submit button calls onSubmit(reason) and closes modal
- [ ] Component accepts recipeName prop and displays in heading
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-010: Update ConversationPage for Refinement Workflow

**Change Type**: modify  
**File**: `src/renderer/pages/ConversationPage.tsx`  
**Instruction**: Implement onReject handler, integrate FeedbackDialog, and trigger refinement IPC

**Current State (Evidence)**: `src/renderer/pages/ConversationPage.tsx:246-249`

```typescript
onReject={() => {
  // TODO: Phase 4/5 - Implement recipe rejection
  console.log('Recipe rejected:', recipe.id, recipe.title);
}}
```

**Modification 1**: Import FeedbackDialog (after line 4)

```typescript
import { RecipeSuggestionCard } from '../components/Conversation/RecipeSuggestionCard';
import { FeedbackDialog } from '../components/Conversation/FeedbackDialog';
```

**Modification 2**: Add feedback dialog state to ConversationState interface (after line 25)

```typescript
interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessageWithSuggestions[];
  isLoading: boolean;
  error: string | null;
  inputValue: string;
  fetchedRecipes: Record<string, Recipe>; // Cache for fetched recipe data
  feedbackDialog: {
    // Add this
    isOpen: boolean;
    recipeId: string | null;
    recipeName: string | null;
  };
}
```

**Modification 3**: Add action types for feedback dialog (after line 41)

```typescript
type ConversationAction =
  | { type: 'session_started'; sessionId: string }
  | { type: 'add_user_message'; content: string }
  | { type: 'add_ai_message'; content: string; timestamp: Date }
  | {
      type: 'add_ai_message_with_suggestions';
      content: string;
      timestamp: Date;
      suggestions: RecipeSuggestion[];
    }
  | { type: 'set_loading'; isLoading: boolean }
  | { type: 'set_error'; error: string }
  | { type: 'set_input'; value: string }
  | { type: 'set_fetched_recipe'; recipeId: string; recipe: Recipe }
  | { type: 'open_feedback_dialog'; recipeId: string; recipeName: string } // Add
  | { type: 'close_feedback_dialog' }; // Add
```

**Modification 4**: Handle new actions in reducer (after line 95)

```typescript
    case 'set_input':
      return { ...state, inputValue: action.value };
    case 'open_feedback_dialog':
      return {
        ...state,
        feedbackDialog: {
          isOpen: true,
          recipeId: action.recipeId,
          recipeName: action.recipeName,
        },
      };
    case 'close_feedback_dialog':
      return {
        ...state,
        feedbackDialog: {
          isOpen: false,
          recipeId: null,
          recipeName: null,
        },
      };
    default:
      return state;
```

**Modification 5**: Initialize feedbackDialog state (line 103)

```typescript
const [state, dispatch] = useReducer(conversationReducer, {
  sessionId: null,
  messages: [],
  isLoading: false,
  error: null,
  inputValue: '',
  fetchedRecipes: {},
  feedbackDialog: { isOpen: false, recipeId: null, recipeName: null }, // Add
});
```

**Modification 6**: Add handleReject and handleFeedbackSubmit functions (after handleSend function, around line 189)

```typescript
const handleReject = (recipeId: string, recipeName: string) => {
  dispatch({ type: 'open_feedback_dialog', recipeId, recipeName });
};

const handleFeedbackSubmit = async (reason?: string) => {
  if (!state.sessionId || !state.feedbackDialog.recipeId) return;

  dispatch({ type: 'close_feedback_dialog' });

  // Step 1: Record rejection
  const rejectResult = await window.electron.conversationAPI.rejectRecipe(
    state.sessionId,
    state.feedbackDialog.recipeId,
    reason
  );

  if (!rejectResult.success) {
    dispatch({ type: 'set_error', error: rejectResult.error || 'Failed to record rejection' });
    return;
  }

  // Step 2: Trigger refinement
  dispatch({ type: 'set_loading', isLoading: true });

  const refineResult = await window.electron.conversationAPI.refine(state.sessionId);

  if (refineResult.success) {
    if (refineResult.suggestions) {
      // New suggestions available
      dispatch({
        type: 'add_ai_message_with_suggestions',
        content: refineResult.aiMessage || 'Here are some other options:',
        timestamp: new Date(),
        suggestions: refineResult.suggestions.suggestions,
      });
    } else {
      // Escalation message (no new suggestions)
      dispatch({
        type: 'add_ai_message',
        content: refineResult.aiMessage || 'Let me help you find a different approach.',
        timestamp: new Date(),
      });
    }
  } else {
    dispatch({ type: 'set_error', error: refineResult.error || 'Failed to refine suggestions' });
  }
};

const handleFeedbackCancel = () => {
  dispatch({ type: 'close_feedback_dialog' });
};
```

**Modification 7**: Update onReject call in RecipeSuggestionCard (line 246-249)

```typescript
onReject={() => {
  handleReject(recipe.id, recipe.title);
}}
```

**Modification 8**: Add FeedbackDialog component to JSX (before closing </div> around line 285)

```typescript
        </form>

        {/* Feedback Dialog */}
        <FeedbackDialog
          isOpen={state.feedbackDialog.isOpen}
          recipeName={state.feedbackDialog.recipeName || ''}
          onClose={handleFeedbackCancel}
          onSubmit={handleFeedbackSubmit}
        />
      </div>
    </div>
  );
}
```

**Evidence**: Pattern follows existing handleSend (lines 169-189): dispatch user action, call IPC, dispatch AI response

**Done When**:

- [ ] FeedbackDialog imported
- [ ] feedbackDialog state added to ConversationState
- [ ] Action types for dialog added
- [ ] Reducer handles open/close dialog actions
- [ ] handleReject opens dialog with recipe info
- [ ] handleFeedbackSubmit calls reject + refine IPC in sequence
- [ ] handleFeedbackCancel closes dialog
- [ ] onReject prop updated to call handleReject
- [ ] FeedbackDialog rendered in JSX
- [ ] Type checking passes
- [ ] Linting passes

---

### PLAN-011: Unit Tests for Rejection Tracking

**Change Type**: create  
**File**: `src/main/conversation/session-manager.test.ts` (extend existing)  
**Instruction**: Add unit tests for addRejectedRecipe function

**Test Cases**:

```typescript
describe('Rejection Tracking', () => {
  it('should add rejected recipe to session', async () => {
    const sessionId = await createSession();
    addRejectedRecipe(sessionId, 'recipe-123', 'Missing ingredient');

    const session = getSession(sessionId);
    expect(session?.rejectedRecipes).toHaveLength(1);
    expect(session?.rejectedRecipes[0]).toEqual({
      recipeId: 'recipe-123',
      reason: 'Missing ingredient',
    });
    expect(session?.refinementCount).toBe(1);
  });

  it('should add rejected recipe without reason', async () => {
    const sessionId = await createSession();
    addRejectedRecipe(sessionId, 'recipe-456');

    const session = getSession(sessionId);
    expect(session?.rejectedRecipes).toHaveLength(1);
    expect(session?.rejectedRecipes[0]).toEqual({
      recipeId: 'recipe-456',
      reason: undefined,
    });
  });

  it('should increment refinement count on each rejection', async () => {
    const sessionId = await createSession();
    addRejectedRecipe(sessionId, 'recipe-1');
    addRejectedRecipe(sessionId, 'recipe-2');
    addRejectedRecipe(sessionId, 'recipe-3');

    const session = getSession(sessionId);
    expect(session?.rejectedRecipes).toHaveLength(3);
    expect(session?.refinementCount).toBe(3);
  });

  it('should throw error if session not found', () => {
    expect(() => addRejectedRecipe('non-existent', 'recipe-123')).toThrow(
      'Session non-existent not found'
    );
  });

  it('should reset turnsInCurrentState on state change', async () => {
    const sessionId = await createSession();
    updateSessionMessages(sessionId, {
      role: 'user',
      content: 'test',
      timestamp: new Date(),
    });
    updateSessionMessages(sessionId, {
      role: 'user',
      content: 'test2',
      timestamp: new Date(),
    });

    let session = getSession(sessionId);
    expect(session?.turnsInCurrentState).toBe(2);

    updateSessionState(sessionId, 'suggesting');
    session = getSession(sessionId);
    expect(session?.turnsInCurrentState).toBe(0);
  });
});
```

**Done When**:

- [ ] 5 test cases added for rejection tracking
- [ ] Tests cover: basic rejection, rejection without reason, multiple rejections, error handling, turnsInCurrentState reset
- [ ] All tests passing
- [ ] Test coverage >90% for new session-manager functions

---

### PLAN-012: Unit Tests for Refinement Context Builder

**Change Type**: create  
**File**: `src/main/conversation/prompts.test.ts` (create new)  
**Instruction**: Add unit tests for buildRefinementContext function

**Test Cases**:

```typescript
import { describe, it, expect } from 'vitest';
import { buildRefinementContext } from './prompts.js';
import type { ConversationSession } from '../../shared/types/conversation.js';
import type { Recipe } from '../../shared/types/recipe.js';

describe('buildRefinementContext', () => {
  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-1',
      title: 'Chicken Pasta',
      /* other required fields */
    },
    {
      id: 'recipe-2',
      title: 'Beef Pasta',
      /* other required fields */
    },
    {
      id: 'recipe-3',
      title: 'Chicken Stir Fry',
      /* other required fields */
    },
  ];

  it('should return empty string if no rejections', () => {
    const session: ConversationSession = {
      sessionId: 'session-1',
      messages: [],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'refining',
      turnCount: 0,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    const context = buildRefinementContext(session, mockRecipes);
    expect(context).toBe('');
  });

  it('should list rejected recipes with reasons', () => {
    const session: ConversationSession = {
      /* base fields */
      rejectedRecipes: [
        { recipeId: 'recipe-1', reason: 'Missing ingredient' },
        { recipeId: 'recipe-2', reason: 'Not in the mood' },
      ],
      refinementCount: 2,
      /* other fields */
    };

    const context = buildRefinementContext(session, mockRecipes);
    expect(context).toContain('Chicken Pasta');
    expect(context).toContain('Beef Pasta');
    expect(context).toContain('Missing ingredient');
    expect(context).toContain('Not in the mood');
  });

  it('should detect pattern when 2+ recipes share ingredient', () => {
    const session: ConversationSession = {
      /* base fields */
      rejectedRecipes: [
        { recipeId: 'recipe-1' }, // Chicken Pasta
        { recipeId: 'recipe-2' }, // Beef Pasta
      ],
      refinementCount: 2,
      /* other fields */
    };

    const context = buildRefinementContext(session, mockRecipes);
    expect(context).toContain('Pattern Detected');
    expect(context).toContain('pasta');
  });

  it('should use different strategy for refinement count 1, 2, 3+', () => {
    const baseSession: ConversationSession = {
      /* base fields */
      rejectedRecipes: [{ recipeId: 'recipe-1' }],
      /* other fields */
    };

    let session = { ...baseSession, refinementCount: 1 };
    let context = buildRefinementContext(session, mockRecipes);
    expect(context).toContain('first refinement');

    session = { ...baseSession, refinementCount: 2 };
    context = buildRefinementContext(session, mockRecipes);
    expect(context).toContain('second refinement');

    session = { ...baseSession, refinementCount: 3 };
    context = buildRefinementContext(session, mockRecipes);
    expect(context).toContain('third+');
  });
});
```

**Done When**:

- [ ] 4 test cases added for refinement context builder
- [ ] Tests cover: no rejections, listing rejections with reasons, pattern detection, strategy by refinement count
- [ ] All tests passing
- [ ] Test coverage >90% for buildRefinementContext

---

### PLAN-013: Integration Tests for Refinement Flow

**Change Type**: modify  
**File**: `src/main/conversation/conversation-service.test.ts` (extend existing)  
**Instruction**: Add integration tests for processRefinement with full workflow

**Test Cases**:

```typescript
describe('processRefinement Integration', () => {
  beforeEach(() => {
    // Setup: Create session, add context, transition to suggesting
    runMigrations();
  });

  it('should successfully refine with rejected recipes', async () => {
    // Create session and set context
    const { createSession } = await import('./session-manager.js');
    const sessionId = await createSession();

    const { updateUserContext, addRejectedRecipe, updateSessionState } =
      await import('./session-manager.js');
    updateUserContext(sessionId, { energyLevel: 'low', availableTime: 30 });
    updateSessionState(sessionId, 'suggesting');
    addRejectedRecipe(sessionId, 'recipe-1', 'Too complex');

    // Mock OpenAI response
    const mockSuggestions = {
      suggestions: [
        {
          recipeId: 'recipe-2',
          relevanceScore: 95,
          reasoning: 'Simple and quick',
          matchedFactors: ['quick', 'low-energy'],
        },
      ],
    };
    mockOpenAI.chat.completions.parse.mockResolvedValue({
      choices: [{ message: { parsed: mockSuggestions } }],
    });

    // Act
    const { processRefinement } = await import('./conversation-service.js');
    const result = await processRefinement(sessionId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeDefined();
    expect(result.aiMessage).toContain('different options');
  });

  it('should return escalation message after 3+ refinements', async () => {
    const sessionId = await createSession();
    updateUserContext(sessionId, { energyLevel: 'low', availableTime: 30 });
    updateSessionState(sessionId, 'suggesting');
    addRejectedRecipe(sessionId, 'recipe-1');
    addRejectedRecipe(sessionId, 'recipe-2');
    addRejectedRecipe(sessionId, 'recipe-3');
    addRejectedRecipe(sessionId, 'recipe-4'); // 4th rejection

    const result = await processRefinement(sessionId);

    expect(result.success).toBe(true);
    expect(result.suggestions).toBeUndefined(); // No suggestions, just escalation
    expect(result.aiMessage).toContain('different approach');
    expect(result.aiMessage).toContain('Browse by category');
  });

  it('should throw error if not in suggesting or refining state', async () => {
    const sessionId = await createSession();
    // Session is in 'gathering' state

    const result = await processRefinement(sessionId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot refine from state');
  });

  it('should transition state from suggesting to refining', async () => {
    const sessionId = await createSession();
    updateUserContext(sessionId, { energyLevel: 'low', availableTime: 30 });
    updateSessionState(sessionId, 'suggesting');
    addRejectedRecipe(sessionId, 'recipe-1');

    mockOpenAI.chat.completions.parse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              suggestions: [
                {
                  recipeId: 'recipe-2',
                  relevanceScore: 90,
                  reasoning: 'Good match',
                  matchedFactors: ['quick'],
                },
              ],
            },
          },
        },
      ],
    });

    await processRefinement(sessionId);

    const session = getSession(sessionId);
    expect(session?.state).toBe('refining');
  });
});
```

**Done When**:

- [ ] 4 integration test cases added
- [ ] Tests cover: successful refinement, escalation at 3+ cycles, state validation, state transition
- [ ] All tests use real database and session-manager
- [ ] OpenAI mocked
- [ ] All tests passing

---

### PLAN-014: Component Tests for FeedbackDialog

**Change Type**: create  
**File**: `src/renderer/components/Conversation/FeedbackDialog.test.tsx`  
**Instruction**: Add component tests for FeedbackDialog with user interactions

**Test Cases**:

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackDialog } from './FeedbackDialog';

describe('FeedbackDialog', () => {
  it('should render when open', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Chicken Pasta"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText(/Why not "Chicken Pasta"/)).toBeInTheDocument();
    expect(screen.getByText('Missing ingredient')).toBeInTheDocument();
    expect(screen.getByText('Not in the mood')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={false}
        recipeName="Chicken Pasta"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByText(/Why not/)).not.toBeInTheDocument();
  });

  it('should call onSubmit with reason when quick-reply clicked', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Missing ingredient'));
    await user.click(screen.getByText('Submit'));

    expect(mockOnSubmit).toHaveBeenCalledWith('Missing ingredient');
  });

  it('should call onSubmit with undefined when Skip clicked', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Skip'));

    expect(mockOnSubmit).toHaveBeenCalledWith(undefined);
  });

  it('should show custom input when Other selected', async () => {
    const user = userEvent.setup();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByText('Other'));

    expect(screen.getByPlaceholderText(/Don't like mushrooms/)).toBeInTheDocument();
  });

  it('should submit custom reason when Other selected and text entered', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Other'));
    await user.type(screen.getByPlaceholderText(/Don't like/), 'Allergic to peanuts');
    await user.click(screen.getByText('Submit'));

    expect(mockOnSubmit).toHaveBeenCalledWith('Allergic to peanuts');
  });

  it('should disable submit when Other selected but no text entered', async () => {
    const user = userEvent.setup();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByText('Other'));

    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();
  });
});
```

**Done When**:

- [ ] 7 component tests added
- [ ] Tests cover: render when open, not render when closed, quick-reply submission, skip submission, custom input visibility, custom reason submission, submit disabled validation
- [ ] All tests passing
- [ ] Test coverage >90% for FeedbackDialog component

---

## Acceptance Criteria

### Functional Criteria (User-Facing)

- [ ] User can reject a suggestion by clicking "Not this one" button
- [ ] Feedback dialog opens with recipe name in heading
- [ ] User can select quick-reply reason or skip feedback
- [ ] Custom text input appears when "Other" selected
- [ ] Rejected recipe ID + reason stored in session state
- [ ] Next suggestion turn does NOT include rejected recipes
- [ ] AI identifies rejection patterns (e.g., "I notice you rejected pasta dishes")
- [ ] AI suggests substitutions for missing ingredients when reason provided
- [ ] Refinement loop works for up to 3 cycles
- [ ] After 3 rejections, system offers escalation options (browse, relax constraints, start fresh)
- [ ] Escalation message feels helpful, not frustrating
- [ ] Refinement continues until user selects recipe or abandons conversation

### Technical Criteria (System-Level)

- [ ] session-manager tracks rejectedRecipes, refinementCount, turnsInCurrentState
- [ ] recipe-ranker excludes rejected recipes from candidates
- [ ] buildRefinementContext injects rejection list + patterns into AI prompt
- [ ] processRefinement enforces max 3 cycle limit
- [ ] conversation:reject-recipe IPC handler records rejection
- [ ] conversation:refine IPC handler triggers refinement workflow
- [ ] FeedbackDialog component handles all feedback scenarios
- [ ] ConversationPage orchestrates reject → refine workflow
- [ ] State transitions: suggesting → refining → refining (up to 3x) → escalation or confirmed
- [ ] No race conditions or stale state in refinement loop

### Testing Criteria (Quality Gates)

- [ ] Unit tests pass for addRejectedRecipe (5 tests)
- [ ] Unit tests pass for buildRefinementContext (4 tests)
- [ ] Integration tests pass for processRefinement (4 tests)
- [ ] Component tests pass for FeedbackDialog (7 tests)
- [ ] All existing tests still pass (no regressions)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Test coverage >85% for new code

---

## Implementor Checklist

- [ ] PLAN-001: Extend ConversationSession type with refinementCount and turnsInCurrentState
- [ ] PLAN-002: Add rejection tracking to session-manager (addRejectedRecipe, field initialization, turn tracking)
- [ ] PLAN-003: Add buildRefinementContext to prompts.ts and modify buildRankingPrompt
- [ ] PLAN-004: Extend recipe-ranker to exclude rejected recipes and pass session to prompt builder
- [ ] PLAN-005: Add processRefinement to conversation-service with max cycle enforcement
- [ ] PLAN-006: Add conversation:reject-recipe and conversation:refine IPC handlers
- [ ] PLAN-007: Extend electron.d.ts with rejectRecipe and refine methods
- [ ] PLAN-008: Update preload.ts with IPC bindings for reject and refine
- [ ] PLAN-009: Create FeedbackDialog component with quick-reply buttons and custom input
- [ ] PLAN-010: Update ConversationPage with handleReject, handleFeedbackSubmit, and FeedbackDialog integration
- [ ] PLAN-011: Write unit tests for session-manager rejection tracking (5 tests)
- [ ] PLAN-012: Write unit tests for buildRefinementContext (4 tests)
- [ ] PLAN-013: Write integration tests for processRefinement (4 tests)
- [ ] PLAN-014: Write component tests for FeedbackDialog (7 tests)

**Total Tasks**: 14

---

## Verification Commands

After completing all tasks, verify with:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run all tests
npm test

# Run specific test suites
npm test session-manager.test.ts
npm test prompts.test.ts
npm test conversation-service.test.ts
npm test FeedbackDialog.test.tsx

# Manual verification
npm run dev
# 1. Start conversation
# 2. Provide context (energy: low, time: 30 min)
# 3. Get suggestions
# 4. Reject a recipe with "Missing ingredient"
# 5. Verify feedback dialog appears
# 6. Verify new suggestions exclude rejected recipe
# 7. Reject 3 more recipes
# 8. Verify escalation message appears (no new suggestions)
```

---

## Dependencies

### Required Prerequisites (from previous phases)

- Phase 0: ConversationSession type exists
- Phase 1: session-manager.ts, IPC handlers infrastructure
- Phase 2: conversation-service.ts, OpenAI integration
- Phase 3: recipe-ranker.ts, RecipeSuggestionCard component, ConversationPage suggestion display

### External Dependencies (already installed)

- OpenAI SDK v6.15.0
- React 18
- TypeScript 5.x
- Vitest for testing
- React Testing Library

### New Dependencies

- None (all dependencies already in place)

---

## Risk Mitigation

### Risk 1: Rejection Loop (User Rejects Everything)

**Mitigation**: Enforce max 3 refinement cycles with escalation strategy offering alternative approaches (browse, relax constraints, start fresh)

### Risk 2: Poor Pattern Detection

**Mitigation**: Start with simple keyword matching (pasta, chicken, etc.). Can enhance in future iterations based on user feedback.

### Risk 3: Escalation Message Feels Frustrating

**Mitigation**: Tone is friendly and offers concrete next steps. User testing in Phase 6 will validate tone.

### Risk 4: State Management Complexity

**Mitigation**: Use existing session-manager pattern. Integration tests verify state transitions work correctly.

---

## Notes

- **Duration Estimate**: 7-10 days (per master plan)
- **Complexity**: Medium-High (multiple interconnected components, state management, AI prompt engineering)
- **Blockers**: None identified (all prerequisites complete)
- **Follow-up**: Phase 5 will implement recipe selection and shopping list generation

---

**Plan Status**: Ready for implementation  
**Created**: 2026-01-06  
**Last Updated**: 2026-01-06  
**Next Phase**: Phase 5 - Selection & Shopping List
