# Fix AI Double Response During Transition to Recipe Suggestions - Implementation Plan

## Inputs
- Research report: `thoughts/shared/research/2026-01-08-AI-Double-Response-Transition-Bug.md`
- User request: Fix the double AI response using Option 2 (update prompt to prevent questions when transitioning)

## Verified Current State

### Fact: Frontend displays both conversational AI message and transition message
- **Evidence:** `src/renderer/pages/ConversationPage.tsx:207-230`
- **Excerpt:**
```typescript
if (result.success && result.aiMessage) {
  dispatch({
    type: 'add_ai_message',
    content: result.aiMessage,  // ← Message 1
    timestamp: result.timestamp || new Date(),
  });

  if (result.shouldTransition && state.sessionId) {
    // ... fetch suggestions ...
    dispatch({
      type: 'add_ai_message_with_suggestions',
      content: suggestionsResult.aiMessage || 'Here are some recipes for you:',  // ← Message 2
      timestamp: new Date(),
      suggestions: suggestionsResult.suggestions,
    });
```

### Fact: Current prompt allows AI to ask questions when shouldTransition is true
- **Evidence:** `src/main/conversation/prompts.ts:36-56`
- **Excerpt:**
```typescript
# Output Format
Respond with JSON matching ConversationTurnSchema:
- aiMessage: Your conversational question/response
- extractedContext: Structured fields extracted from user's response
- shouldTransition: true if you have energyLevel AND availableTime, false otherwise

# Example Conversational Flow
User: "Maybe 30 minutes tops"
Response: {
  "aiMessage": "Perfect! Quick and easy it is. Any cravings? Pasta, chicken, something else? Or I can just surprise you!",
  "extractedContext": { "energyLevel": "low", "availableTime": 30 },
  "shouldTransition": true  // ← Asks question AND transitions
}
```

### Fact: Hardcoded transition message exists in backend
- **Evidence:** `src/main/conversation/conversation-service.ts:160-161`
- **Excerpt:**
```typescript
// Step 7: Build AI message
const aiMessage = "Great! Based on your context, here are some recipes I think you'll love:";
```

## Goals / Non-Goals

### Goals
1. Eliminate the double AI response when transitioning to recipe suggestions
2. Ensure AI provides an enthusiastic, contextual intro statement (NOT a question) when `shouldTransition: true`
3. Preserve warm, conversational tone throughout the gathering phase
4. Maintain single-question-at-a-time behavior when `shouldTransition: false`

### Non-Goals
- Changing the transition logic or state management
- Modifying recipe ranking or refinement flows
- Updating frontend message display components (except skipping first message when transitioning)
- Changing the schema structure

## Design Overview

### Current Flow (Problematic)
1. User sends message → AI responds with question + `shouldTransition: true`
2. Frontend displays AI's question message
3. Frontend immediately fetches suggestions
4. Frontend displays hardcoded transition message + recipes
5. **Result:** Two consecutive AI messages

### New Flow (Fixed)
1. User sends message → AI responds with enthusiastic intro statement + `shouldTransition: true`
2. Frontend **skips** displaying AI's message when `shouldTransition: true`
3. Frontend fetches suggestions
4. Frontend displays AI's contextual intro message (passed from Step 1) + recipes
5. **Result:** One contextual message with recipes

### Key Changes
- **Prompt:** Add explicit instructions for `shouldTransition: true` behavior
- **Prompt:** Update examples to show intro statements instead of questions when transitioning
- **Backend:** Pass AI's contextual message from `processConversationTurn()` to `transitionToSuggesting()` instead of using hardcoded message
- **Frontend:** Skip displaying first message when `shouldTransition: true`

## Implementation Instructions (For Implementor)

### PLAN-001: Update GATHERING_SYSTEM_PROMPT to prevent questions when transitioning
- **Action ID:** PLAN-001
- **Change Type:** modify
- **File(s):** `src/main/conversation/prompts.ts`
- **Instruction:**
  1. Locate the `GATHERING_SYSTEM_PROMPT` constant (line 19)
  2. In the "# Output Format" section (around line 36-40), update the `aiMessage` field description:
     - **Current:** `- aiMessage: Your conversational question/response`
     - **New:** `- aiMessage: Your conversational response (see rules below)`
  3. After the `shouldTransition` line (line 40), add a new section with transition-specific rules:
     ```
     
     # Critical Rules for aiMessage
     - When shouldTransition is FALSE: Ask a warm, friendly question to gather the next piece of information
     - When shouldTransition is TRUE: Provide an enthusiastic, contextual intro statement (NOT a question) that acknowledges their context and prepares them for recipe suggestions
     - Your aiMessage when shouldTransition=true will be displayed immediately before recipe cards, so make it feel like a natural lead-in
     ```
  4. Update the example conversational flow (lines 42-64) to show proper transition behavior:
     - **Line 52-57:** Change the example where `shouldTransition: true` to use an intro statement instead of a question
     - **Current example:**
       ```typescript
       User: "Maybe 30 minutes tops"
       Response: {
         "aiMessage": "Perfect! Quick and easy it is. Any cravings? Pasta, chicken, something else? Or I can just surprise you!",
         "extractedContext": { "energyLevel": "low", "availableTime": 30 },
         "shouldTransition": true
       }
       ```
     - **New example:**
       ```typescript
       User: "Maybe 30 minutes tops"
       Response: {
         "aiMessage": "Perfect! With low energy and 30 minutes, let me find you some quick and easy recipes that won't require much effort!",
         "extractedContext": { "energyLevel": "low", "availableTime": 30 },
         "shouldTransition": true
       }
       ```
  5. Remove or update the third example (lines 59-64) since it shows a follow-up question after `shouldTransition: true`, which is the pattern we're fixing
     - **Option A:** Remove it entirely
     - **Option B:** Change it to show `shouldTransition: false` with the question, then add a fourth example showing the final transition with intro statement
- **Evidence:** `src/main/conversation/prompts.ts:19-64` (current prompt structure needs these updates)
- **Done When:** 
  - Prompt explicitly instructs AI to use intro statements (NOT questions) when `shouldTransition: true`
  - Examples demonstrate the correct pattern
  - `npm run build` succeeds without TypeScript errors

### PLAN-002: Update conversation-service to pass AI's contextual message to transition
- **Action ID:** PLAN-002
- **Change Type:** modify
- **File(s):** `src/main/conversation/conversation-service.ts`
- **Instruction:**
  1. Modify `transitionToSuggesting()` function signature to accept an optional `contextualMessage` parameter (line 132):
     ```typescript
     export async function transitionToSuggesting(
       sessionId: string,
       contextualMessage?: string
     ): Promise<SuggestionResult>
     ```
  2. Update the AI message building logic (lines 160-161):
     - **Current:**
       ```typescript
       // Step 7: Build AI message
       const aiMessage = "Great! Based on your context, here are some recipes I think you'll love:";
       ```
     - **New:**
       ```typescript
       // Step 7: Use contextual AI message if provided, otherwise fallback to generic message
       const aiMessage = contextualMessage || "Great! Based on your context, here are some recipes I think you'll love:";
       ```
  3. The fallback message preserves current behavior if `contextualMessage` is not provided
- **Evidence:** `src/main/conversation/conversation-service.ts:132-168` (function signature and message building)
- **Done When:**
  - Function accepts optional `contextualMessage` parameter
  - Function uses provided message when available, falls back to hardcoded message otherwise
  - `npm run build` succeeds without TypeScript errors

### PLAN-003: Update IPC handler to pass AI message through to transitionToSuggesting
- **Action ID:** PLAN-003
- **Change Type:** modify
- **File(s):** `src/main/ipc/conversation-handlers.ts`
- **Instruction:**
  1. Locate the `conversation:send-message` handler (around line 24-65)
  2. After calling `processConversationTurn()`, if `result.shouldTransition` is true, store the AI message to pass to `transitionToSuggesting()`
  3. Find the `conversation:get-suggestions` handler (around line 141-160)
  4. Currently it only receives `sessionId`. We need to pass the contextual AI message from the previous turn
  5. **Problem identified:** The current architecture has `sendMessage` and `getSuggestions` as separate IPC calls. The frontend receives `shouldTransition: true` from `sendMessage`, then calls `getSuggestions` separately. The AI message from `sendMessage` is lost between calls.
  6. **Solution:** Store the AI message in the session when `shouldTransition: true`, then retrieve it in `transitionToSuggesting()`
  7. Update `processConversationTurn()` to store the AI message when transitioning:
     - After line 102 in `conversation-service.ts` (after adding AI message to session), check if `shouldTransition: true`
     - If true, store the AI message in session metadata (requires adding a field to session)
  8. Update `transitionToSuggesting()` to retrieve and use the stored AI message:
     - Retrieve the stored message from session metadata
     - Pass it as the `aiMessage` in the return value
     - Clear the stored message after using it
- **Evidence:** `src/main/ipc/conversation-handlers.ts:24-160` (handler structure), `src/main/conversation/conversation-service.ts:102-110` (message storage location)
- **Done When:**
  - AI message from `processConversationTurn()` is stored when `shouldTransition: true`
  - `transitionToSuggesting()` retrieves and uses the stored message
  - Stored message is cleared after use to prevent stale data
  - `npm run build` succeeds without TypeScript errors

### PLAN-004: Add transitionMessage field to ConversationSession type
- **Action ID:** PLAN-004
- **Change Type:** modify
- **File(s):** `src/shared/types/conversation.ts`
- **Instruction:**
  1. Locate the `ConversationSession` interface
  2. Add a new optional field `transitionMessage?: string` to store the AI's contextual message when transitioning
  3. This field will be populated when `shouldTransition: true` and consumed by `transitionToSuggesting()`
  4. Add JSDoc comment explaining the field's purpose:
     ```typescript
     /**
      * Contextual AI message to display when transitioning to recipe suggestions.
      * Set by processConversationTurn() when shouldTransition=true.
      * Consumed and cleared by transitionToSuggesting().
      */
     transitionMessage?: string;
     ```
- **Evidence:** Need to read `src/shared/types/conversation.ts` to verify current structure
- **Done When:**
  - `transitionMessage` field exists in `ConversationSession` interface
  - Field has proper JSDoc documentation
  - `npm run build` succeeds without TypeScript errors

### PLAN-005: Update session-manager to support storing/retrieving transitionMessage
- **Action ID:** PLAN-005
- **Change Type:** modify
- **File(s):** `src/main/conversation/session-manager.ts`
- **Instruction:**
  1. Add a new function `setSessionTransitionMessage(sessionId: string, message: string): void`
     - Sets the `transitionMessage` field on the session
  2. Add a new function `getSessionTransitionMessage(sessionId: string): string | undefined`
     - Retrieves the `transitionMessage` field from the session
  3. Add a new function `clearSessionTransitionMessage(sessionId: string): void`
     - Sets the `transitionMessage` field to `undefined`
  4. Follow the same pattern as existing session update functions (e.g., `updateSessionState`, `updateSessionMessages`)
- **Evidence:** Need to read `src/main/conversation/session-manager.ts` to verify current function patterns
- **Done When:**
  - Three new functions exist for managing `transitionMessage`
  - Functions follow existing patterns in the module
  - Functions properly validate session existence
  - `npm run build` succeeds without TypeScript errors

### PLAN-006: Update processConversationTurn to store AI message when transitioning
- **Action ID:** PLAN-006
- **Change Type:** modify
- **File(s):** `src/main/conversation/conversation-service.ts`
- **Instruction:**
  1. Import the new `setSessionTransitionMessage` function from session-manager
  2. After Step 7 (line 102-107) where AI message is added to session, add a new step:
     ```typescript
     // Step 8: If transitioning, store the AI message for use in transitionToSuggesting()
     if (parsed.shouldTransition) {
       setSessionTransitionMessage(sessionId, parsed.aiMessage);
     }
     
     // Step 9: Return parsed result
     return parsed;
     ```
  3. Update step numbers in comments accordingly
- **Evidence:** `src/main/conversation/conversation-service.ts:102-110` (current step 7-8 location)
- **Done When:**
  - AI message is stored in session when `shouldTransition: true`
  - Function still returns the full `ConversationTurnOutput` unchanged
  - `npm run build` succeeds without TypeScript errors

### PLAN-007: Update transitionToSuggesting to retrieve and use stored AI message
- **Action ID:** PLAN-007
- **Change Type:** modify
- **File(s):** `src/main/conversation/conversation-service.ts`
- **Instruction:**
  1. Import the new `getSessionTransitionMessage` and `clearSessionTransitionMessage` functions from session-manager
  2. After Step 1 (line 134-138) where session is retrieved, add a new step:
     ```typescript
     // Step 2: Retrieve stored transition message from previous conversation turn
     const contextualMessage = getSessionTransitionMessage(sessionId);
     
     // Step 3: Clear the stored message (one-time use)
     if (contextualMessage) {
       clearSessionTransitionMessage(sessionId);
     }
     ```
  3. Update the AI message building logic (currently Step 7, line 160-161) to use the retrieved message:
     ```typescript
     // Step 8: Use contextual AI message from conversation turn, or fallback to generic message
     const aiMessage = contextualMessage || "Great! Based on your context, here are some recipes I think you'll love:";
     ```
  4. Update all step numbers in comments accordingly
  5. Remove the unused `contextualMessage` parameter from the function signature (added in PLAN-002) since we're now using session storage instead
- **Evidence:** `src/main/conversation/conversation-service.ts:132-168` (current function structure)
- **Done When:**
  - Function retrieves stored transition message from session
  - Stored message is cleared after retrieval
  - Contextual message is used when available
  - Fallback message is used when no contextual message exists
  - `npm run build` succeeds without TypeScript errors

### PLAN-008: Update frontend to skip first message when transitioning
- **Action ID:** PLAN-008
- **Change Type:** modify
- **File(s):** `src/renderer/pages/ConversationPage.tsx`
- **Instruction:**
  1. Locate the `handleSend` function (line 196-250)
  2. Find the block where AI message is added (lines 207-212)
  3. Modify the logic to skip adding the first message when `shouldTransition: true`:
     - **Current:**
       ```typescript
       if (result.success && result.aiMessage) {
         dispatch({
           type: 'add_ai_message',
           content: result.aiMessage,
           timestamp: result.timestamp || new Date(),
         });

         // Check if AI wants to show suggestions
         if (result.shouldTransition && state.sessionId) {
       ```
     - **New:**
       ```typescript
       if (result.success && result.aiMessage) {
         // Check if AI wants to show suggestions
         if (result.shouldTransition && state.sessionId) {
           // Skip adding the conversational message - it will be shown with recipes
           dispatch({ type: 'set_loading', isLoading: true });
       ```
  4. Move the loading dispatch inside the `shouldTransition` block (it's already there, just needs the comment update)
  5. Add an `else` block to handle the case when NOT transitioning:
     ```typescript
         } else {
           // Not transitioning yet - display the conversational message
           dispatch({
             type: 'add_ai_message',
             content: result.aiMessage,
             timestamp: result.timestamp || new Date(),
           });
         }
       } else {
         dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
       }
     ```
  6. Preserve all existing logic within the `shouldTransition` block (suggestion fetching, error handling, etc.)
- **Evidence:** `src/renderer/pages/ConversationPage.tsx:207-249` (current message handling logic)
- **Done When:**
  - When `shouldTransition: false`, AI message is displayed normally
  - When `shouldTransition: true`, AI message is NOT displayed (will be shown with recipes)
  - All existing suggestion fetching logic is preserved
  - `npm run build` succeeds without TypeScript errors

### PLAN-009: Add JSDoc comments explaining the new behavior
- **Action ID:** PLAN-009
- **Change Type:** modify
- **File(s):** 
  - `src/main/conversation/conversation-service.ts`
  - `src/main/conversation/session-manager.ts`
  - `src/renderer/pages/ConversationPage.tsx`
- **Instruction:**
  1. In `conversation-service.ts`, update the JSDoc for `processConversationTurn()` (line 53-59) to mention transition message storage:
     ```typescript
     /**
      * Processes a single conversation turn with the user.
      * Sends user message to AI, extracts context, and returns AI response.
      * If shouldTransition=true, stores the AI message for use in transitionToSuggesting().
      *
      * @param sessionId - The session ID to process
      * @param userMessage - The user's message text
      * @returns AI response with extracted context and transition flag
      */
     ```
  2. In `conversation-service.ts`, update the JSDoc for `transitionToSuggesting()` (line 125-131) to mention contextual message retrieval:
     ```typescript
     /**
      * Transitions a session from gathering to suggesting state.
      * Verifies required context, fetches ranked suggestions, and updates session.
      * Uses the contextual AI message stored during the previous conversation turn.
      *
      * @param sessionId - The session ID to transition
      * @returns Result with suggestions and contextual AI message, or error
      */
     ```
  3. In `session-manager.ts`, add JSDoc for the three new functions
  4. In `ConversationPage.tsx`, add a comment explaining the skip logic (above the `if (result.shouldTransition)` check):
     ```typescript
     // When transitioning to suggestions, skip displaying the conversational message here.
     // The AI's message will be shown with the recipe cards instead (from getSuggestions).
     // This prevents showing two consecutive AI messages.
     ```
- **Evidence:** Function JSDoc locations in source files
- **Done When:**
  - All modified functions have updated JSDoc comments
  - Frontend skip logic has explanatory comment
  - Documentation accurately reflects new behavior
  - `npm run build` succeeds without TypeScript errors

## Verification Tasks (If Assumptions Exist)

### Assumption 1: ConversationSession type structure
- **Assumption:** `ConversationSession` interface exists in `src/shared/types/conversation.ts` and can be extended with `transitionMessage` field
- **Verification Step:** Read `src/shared/types/conversation.ts` and verify interface structure
- **Pass Condition:** Interface exists and has no conflicting fields

### Assumption 2: session-manager function patterns
- **Assumption:** `session-manager.ts` follows a consistent pattern for session field updates
- **Verification Step:** Read `src/main/conversation/session-manager.ts` and identify existing update patterns
- **Pass Condition:** Patterns like `updateSessionX` or `setSessionX` exist and can be replicated

## Acceptance Criteria

1. **Single AI Message Display**: When transitioning to recipe suggestions, only ONE AI message appears before recipe cards
2. **Contextual Intro**: The displayed message is the AI's contextual intro statement (e.g., "Awesome! With high energy and an hour to spare, let me find you something really tasty!"), NOT a generic hardcoded message
3. **No Questions When Transitioning**: AI does not ask follow-up questions when `shouldTransition: true`
4. **Conversational Flow Preserved**: When NOT transitioning, AI continues to ask one question at a time with warm, friendly tone
5. **Build Success**: `npm run build` completes without errors
6. **Type Safety**: All TypeScript types are correctly updated and no `any` types are introduced
7. **Backward Compatibility**: If no contextual message is stored (edge cases), system falls back to generic message without crashing

## Implementor Checklist
- [ ] PLAN-001: Update GATHERING_SYSTEM_PROMPT with transition rules and examples
- [ ] PLAN-002: Update transitionToSuggesting signature (NOTE: Superseded by PLAN-007, which uses session storage instead)
- [ ] PLAN-003: Update IPC handler strategy (NOTE: Replaced by session storage approach in PLAN-004 through PLAN-007)
- [ ] PLAN-004: Add transitionMessage field to ConversationSession type
- [ ] PLAN-005: Add session-manager functions for transitionMessage
- [ ] PLAN-006: Store AI message in processConversationTurn when transitioning
- [ ] PLAN-007: Retrieve and use stored AI message in transitionToSuggesting
- [ ] PLAN-008: Skip first message in frontend when transitioning
- [ ] PLAN-009: Add JSDoc comments explaining new behavior
- [ ] Verify all acceptance criteria are met
- [ ] Run `npm run build` to confirm no TypeScript errors
- [ ] Test conversational flow manually to verify single-message behavior
