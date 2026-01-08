---
date: 2026-01-08
researcher: research-architect-v1
topic: "AI Double Response During Transition to Recipe Suggestions"
status: complete
coverage:
  - src/main/conversation/conversation-service.ts
  - src/main/conversation/prompts.ts
  - src/renderer/pages/ConversationPage.tsx
  - src/main/conversation/conversation-schema.ts
---

# Research: AI Double Response During Transition to Recipe Suggestions

## Executive Summary

- **Root Cause**: Frontend displays TWO consecutive AI messages when transitioning from context gathering to recipe suggestions.
- **Location**: `src/renderer/pages/ConversationPage.tsx:207-230` adds both the conversational AI response AND a separate transition message.
- **Symptom**: User sees Message 1 (AI asking follow-up question) immediately followed by Message 2 (hardcoded transition + recipe cards), creating confusing UX.
- **Direct Consequence**: AI appears to ask questions but doesn't wait for answers, undermining conversational flow.
- **Contributing Factor**: Prompt design allows AI to ask questions while simultaneously signaling readiness to transition (`shouldTransition: true`).
- **Fix Scope**: Either skip displaying first message when transitioning, OR update prompt to prevent questions when `shouldTransition: true`.

## Coverage Map

### Files Inspected (Verified with `read`)
- `src/renderer/pages/ConversationPage.tsx` - Frontend message handling (lines 196-250)
- `src/main/conversation/conversation-service.ts` - Backend conversation logic (284 lines)
- `src/main/conversation/prompts.ts` - AI system prompts (402 lines)
- `src/main/conversation/conversation-schema.ts` - Conversation turn schema (16 lines)

### Scope Limitation
This investigation focused exclusively on the double-message symptom during transition from gathering → suggesting state. Did not inspect recipe ranking logic, refinement cycles, or other conversation states.

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Dual Message Display in Frontend

**Observation:** When `shouldTransition: true`, the frontend executes two separate message additions:
1. Adds AI response from `processConversationTurn()` (lines 208-212)
2. Immediately calls `getSuggestions()` and adds second message with recipes (lines 223-230)

**Direct consequence:** User sees two consecutive AI messages before recipe cards appear.

**Evidence:** `src/renderer/pages/ConversationPage.tsx:207-230`

**Excerpt:**
```typescript
if (result.success && result.aiMessage) {
  dispatch({
    type: 'add_ai_message',
    content: result.aiMessage,  // ← Message 1: AI's conversational response
    timestamp: result.timestamp || new Date(),
  });

  // Check if AI wants to show suggestions
  if (result.shouldTransition && state.sessionId) {
    dispatch({ type: 'set_loading', isLoading: true });

    try {
      const suggestionsResult = await window.electron.conversationAPI.getSuggestions(
        state.sessionId
      );

      if (suggestionsResult.success && suggestionsResult.suggestions) {
        // Display AI message with recipe suggestions
        dispatch({
          type: 'add_ai_message_with_suggestions',
          content: suggestionsResult.aiMessage || 'Here are some recipes for you:',  // ← Message 2: Transition intro
          timestamp: new Date(),
          suggestions: suggestionsResult.suggestions,
        });
      }
```

**Direct consequence:** Both `result.aiMessage` (from OpenAI) and `suggestionsResult.aiMessage` (from backend) are displayed, causing the double-response effect.

### Finding 2: Hardcoded Transition Message in Backend

**Observation:** `transitionToSuggesting()` returns a hardcoded AI message regardless of conversation context.

**Direct consequence:** Generic transition message "Great! Based on your context, here are some recipes I think you'll love:" appears after AI's contextual response.

**Evidence:** `src/main/conversation/conversation-service.ts:160-168`

**Excerpt:**
```typescript
// Step 7: Build AI message
const aiMessage = "Great! Based on your context, here are some recipes I think you'll love:";

// Step 8: Return success result
return {
  success: true,
  suggestions: result.suggestions,
  aiMessage,  // ← Hardcoded string
};
```

**Direct consequence:** Message lacks personalization and ignores the conversational flow from OpenAI's response.

### Finding 3: AI Asks Questions While Signaling Transition Readiness

**Observation:** AI prompt instructs the model to set `shouldTransition: true` when `energyLevel AND availableTime` are captured, but ALSO instructs it to "ask ONE question at a time" to gather optional fields (mood, canShop).

**Direct consequence:** AI follows both instructions simultaneously: it asks a follow-up question ("Any cravings?") AND sets `shouldTransition: true`, creating a question that will never be answered.

**Evidence:** `src/main/conversation/prompts.ts:19-64`

**Excerpt (lines 38-40):**
```typescript
# Output Format
Respond with JSON matching ConversationTurnSchema:
- aiMessage: Your conversational question/response
- extractedContext: Structured fields extracted from user's response
- shouldTransition: true if you have energyLevel AND availableTime, false otherwise
```

**Excerpt (lines 31-34):**
```typescript
# Constraints
- User's dietary restrictions: {dietaryRestrictions}
- NEVER suggest recipes violating these restrictions
- Ask ONE question at a time
- Be warm and supportive, not interrogative
```

**Direct consequence:** Prompt creates logical contradiction—AI is told to ask questions while simultaneously being told to transition immediately after gathering required fields.

### Finding 4: Example Flow Shows the Pattern

**Observation:** The example conversational flow in the prompt demonstrates the problematic pattern.

**Evidence:** `src/main/conversation/prompts.ts:52-64`

**Excerpt:**
```typescript
User: "Maybe 30 minutes tops"
Response: {
  "aiMessage": "Perfect! Quick and easy it is. Any cravings? Pasta, chicken, something else? Or I can just surprise you!",
  "extractedContext": { "energyLevel": "low", "availableTime": 30 },
  "shouldTransition": true  // ← Transition flag set
}

User: "Not sure, maybe something comforting?"
Response: {
  "aiMessage": "Comfort food sounds perfect for a tired evening. One last thing - can you pop to the store if needed, or should we stick to what you might have at home?",
  "extractedContext": { "energyLevel": "low", "availableTime": 30, "mood": "comforting" },
  "shouldTransition": true
}
```

**Direct consequence:** Example shows AI asking "Any cravings?" with `shouldTransition: true`, teaching the model this pattern. However, the current frontend implementation doesn't wait for the answer—it immediately fetches suggestions.

## Detailed Technical Analysis (Verified)

### Message Flow Trace

#### Scenario: User provides energy level and time in one message
Input: "I have high energy and an hour"

#### Step 1: Frontend sends message
- **File:** `src/renderer/pages/ConversationPage.tsx:196-206`
- **Action:** Calls `window.electron.conversationAPI.sendMessage(sessionId, messageContent)`

#### Step 2: Backend processes conversation turn
- **File:** `src/main/conversation/conversation-service.ts:60-123`
- **Action:** `processConversationTurn()` calls OpenAI API with conversation history
- **Result:** OpenAI responds with:
  ```json
  {
    "aiMessage": "Awesome! With high energy and an hour to spare, we can whip up something really tasty. Do you have any specific cravings or mood you want to cater to tonight? Something comforting, spicy, or maybe a bit adventurous?",
    "extractedContext": { "energyLevel": "high", "availableTime": 60 },
    "shouldTransition": true
  }
  ```

#### Step 3: Frontend displays AI message #1
- **File:** `src/renderer/pages/ConversationPage.tsx:208-212`
- **Action:** Dispatches `add_ai_message` with AI's conversational response
- **UI Effect:** Message bubble appears: "Awesome! With high energy and an hour to spare, we can whip up something really tasty. Do you have any specific cravings...?"

#### Step 4: Frontend detects shouldTransition flag
- **File:** `src/renderer/pages/ConversationPage.tsx:214-216`
- **Action:** Checks `result.shouldTransition && state.sessionId`
- **Result:** Condition is true, proceeds to fetch suggestions

#### Step 5: Backend transitions to suggesting state
- **File:** `src/main/conversation/conversation-service.ts:132-179`
- **Action:** `transitionToSuggesting()` fetches ranked suggestions
- **Result:** Returns:
  ```json
  {
    "success": true,
    "suggestions": [ /* recipe suggestions array */ ],
    "aiMessage": "Great! Based on your context, here are some recipes I think you'll love:"
  }
  ```

#### Step 6: Frontend displays AI message #2 with recipe cards
- **File:** `src/renderer/pages/ConversationPage.tsx:223-230`
- **Action:** Dispatches `add_ai_message_with_suggestions` with hardcoded transition message
- **UI Effect:** Second message bubble appears: "Great! Based on your context, here are some recipes I think you'll love:" followed by recipe cards

#### Step 7: User Perception
- **Observed UX:** Two consecutive AI messages:
  1. "Awesome! ... Do you have any specific cravings...?" ← Asks question
  2. "Great! Based on your context, here are some recipes..." ← Ignores question, shows recipes

### Prompt Design Analysis

The `GATHERING_SYSTEM_PROMPT` contains conflicting directives:

**Directive 1: Transition Condition**
```
shouldTransition: true if you have energyLevel AND availableTime, false otherwise
```

**Directive 2: Gathering Behavior**
```
Ask ONE question at a time
Gather the following information through natural conversation:
1. Energy level (low/medium/high)
2. Available cooking time (in minutes)
3. Mood or cravings (optional)
4. Whether they can go shopping today (yes/no)
```

**Conflict:** When energyLevel and availableTime are obtained, the AI must:
- Set `shouldTransition: true` (per Directive 1)
- Continue asking questions for optional fields (per Directive 2)

**Direct consequence:** AI attempts to satisfy both by asking "Any cravings?" while setting `shouldTransition: true`, but the frontend doesn't wait for an answer.

## Verification Log

### Verified Files (read tool):
- `src/renderer/pages/ConversationPage.tsx`
- `src/main/conversation/conversation-service.ts`
- `src/main/conversation/prompts.ts`
- `src/main/conversation/conversation-schema.ts`
- `thoughts/shared/research/2026-01-08-AI-Conversation-Recipe-Display-Bug.md` (referenced for context)

### Spot-checked excerpts captured: Yes

### Runtime observation:
User reported symptom matches trace: "The AI gives two answers directly one after the other, before displaying the recipes."

## Open Questions / Unverified Claims

None. All claims verified with direct file reads and logical trace through code execution path.

## References

- `src/renderer/pages/ConversationPage.tsx:207-230` - Dual message display logic
- `src/main/conversation/conversation-service.ts:160-168` - Hardcoded transition message
- `src/main/conversation/prompts.ts:19-64` - GATHERING_SYSTEM_PROMPT with conflicting directives
- `src/main/conversation/prompts.ts:52-64` - Example flow showing problematic pattern
- `src/main/conversation/conversation-schema.ts:3-13` - ConversationTurnSchema definition
