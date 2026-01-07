---
date: 2026-01-07
planner: assistant
epic-id: 'EPIC-002'
status: ready-for-implementation
priority: critical
type: bugfix
dependencies:
  - 'Phase 3: Recipe Suggestion & Ranking (COMPLETE)'
  - 'Phase 4: Feedback & Iterative Refinement (COMPLETE)'
---

# Fix Conversation Transition Gap - Implementation Plan

## Inputs

### Source Documents

- **Root Cause Analysis**: Performed 2026-01-07
- **Phase 3 STATE**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase3-STATE.md`
- **Phase 4 STATE**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase4-STATE.md`
- **Master Plan**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`

### User Request Summary

Fix critical bug where AI conversation never shows recipe suggestions to the user. The AI correctly gathers context and signals readiness to transition (`shouldTransition: true`), but the frontend never detects this signal and never calls `getSuggestions()`. This causes the AI to "talk and talk and talk" without ever showing recipe cards.

**Impact**: Feature completely broken from user perspective - no recipe suggestions ever appear.

---

## Verified Current State

### Evidence 1: IPC Handler Does NOT Return shouldTransition Flag

**Fact**: The `conversation:sendMessage` IPC handler processes the transition internally but does not inform the frontend about it.

**Evidence**: `src/main/ipc/conversation-handlers.ts:69-78`

**Excerpt**:
```typescript
// Transition state if AI indicates readiness
if (turnResult.shouldTransition) {
  updateSessionState(sessionId, 'suggesting');
}

return {
  success: true,
  aiMessage: turnResult.aiMessage,
  timestamp: new Date(),
  // ← MISSING: shouldTransition not returned to frontend
};
```

**Issue**: Backend changes state to `'suggesting'` but frontend has no way to know this happened.

---

### Evidence 2: Frontend Never Checks for Transition

**Fact**: The `handleSend` function in ConversationPage only displays the AI message but never checks if suggestions should be fetched.

**Evidence**: `src/renderer/pages/ConversationPage.tsx:196-216`

**Excerpt**:
```typescript
const result = await window.electron.conversationAPI.sendMessage(
  state.sessionId,
  messageContent
);
if (result.success && result.aiMessage) {
  dispatch({
    type: 'add_ai_message',
    content: result.aiMessage,
    timestamp: result.timestamp || new Date(),
  });
  // ← MISSING: No check for result.shouldTransition
  // ← MISSING: No call to getSuggestions()
} else {
  dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
}
```

**Issue**: Even if `shouldTransition` were returned, the code doesn't use it.

---

### Evidence 3: Type Definition Missing shouldTransition

**Fact**: The TypeScript type for `sendMessage` return value does not include `shouldTransition` field.

**Evidence**: `src/shared/types/electron.d.ts:10-13`

**Excerpt**:
```typescript
sendMessage: (
  sessionId: string,
  message: string
) => Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }>;
```

**Issue**: Type definition doesn't include the `shouldTransition` field needed for the fix.

---

### Evidence 4: getSuggestions IPC Handler Already Exists

**Fact**: The infrastructure to fetch suggestions already exists and works correctly.

**Evidence**: `src/main/ipc/conversation-handlers.ts:140-159`

**Excerpt**:
```typescript
ipcMain.handle('conversation:get-suggestions', async (event, sessionId: string) => {
  if (!event.senderFrame || !validateSender(event.senderFrame)) {
    return { success: false, error: 'Unauthorized IPC sender' };
  }

  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    const result = await transitionToSuggesting(sessionId);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});
```

**Fact**: This handler is already registered and tested (Phase 3), but never called by the frontend.

---

### Evidence 5: Existing Tests Verify State Transition

**Fact**: Existing tests verify that `shouldTransition` causes state change, but don't verify frontend behavior.

**Evidence**: `src/main/ipc/conversation-handlers.test.ts:155-195`

**Excerpt**:
```typescript
it('transitions state when AI signals readiness', async () => {
  // Mock processConversationTurn to return AI response with transition
  const { processConversationTurn } = await import('../conversation/conversation-service.js');
  vi.mocked(processConversationTurn).mockResolvedValue({
    aiMessage: 'Perfect! Let me find some recipes for you.',
    extractedContext: { availableTime: 30 },
    shouldTransition: true,
  });

  // ...

  // Verify state WAS transitioned (shouldTransition=true)
  const { updateSessionState } = await import('../conversation/session-manager.js');
  expect(updateSessionState).toHaveBeenCalledWith('test-session-123', 'suggesting');
});
```

**Issue**: Test verifies backend behavior but not the missing frontend integration.

---

## Goals / Non-Goals

### Goals

1. **Return `shouldTransition` from IPC handler** so frontend knows when to fetch suggestions
2. **Frontend detects transition** and automatically calls `getSuggestions()`
3. **Display recipe suggestions** immediately after AI signals readiness
4. **Comprehensive tests** to prevent regression of this critical bug
5. **Maintain backward compatibility** - don't break existing conversation flow

### Non-Goals

- Change the AI's decision logic for when to transition (already correct)
- Modify the suggestion ranking algorithm (already works)
- Add new UI features beyond the fix
- Change session management or state machine logic

---

## Design Overview

### Current Flow (Broken)

```
User sends message
  → IPC: conversation:sendMessage
    → AI returns {aiMessage, shouldTransition: true}
    → Backend: updateSessionState(sessionId, 'suggesting')  ← State changes here
    → Return {success, aiMessage}  ← shouldTransition NOT returned
  → Frontend displays aiMessage
  → ❌ User sees only text, no recipe suggestions
  → User sends another message
  → Cycle repeats forever
```

### Fixed Flow

```
User sends message
  → IPC: conversation:sendMessage
    → AI returns {aiMessage, shouldTransition: true}
    → Backend: updateSessionState(sessionId, 'suggesting')
    → Return {success, aiMessage, shouldTransition: true}  ← NEW: Flag returned
  → Frontend displays aiMessage
  → Frontend detects shouldTransition === true  ← NEW: Check added
    → IPC: conversation:getSuggestions(sessionId)
      → Returns {success, suggestions, aiMessage}
    → Frontend displays suggestion message + recipe cards
  → ✅ User sees recipe suggestions
```

### Error Handling Strategy

1. **If getSuggestions fails**: Display error message, allow user to retry or continue conversation
2. **Loading state**: Show "Finding recipes..." indicator while fetching
3. **Race condition**: Disable input while fetching suggestions to prevent double-sends

---

## Implementation Instructions (For Implementor)

### PLAN-001: Update IPC Handler to Return shouldTransition

**Change Type**: modify

**File**: `src/main/ipc/conversation-handlers.ts`

**Instruction**:

1. Open `src/main/ipc/conversation-handlers.ts`
2. Locate the `conversation:sendMessage` handler (line 45)
3. Find the return statement at line 73
4. Add `shouldTransition: turnResult.shouldTransition` to the returned object

**Current Code** (lines 73-78):
```typescript
return {
  success: true,
  aiMessage: turnResult.aiMessage,
  timestamp: new Date(),
};
```

**Required Change**:
```typescript
return {
  success: true,
  aiMessage: turnResult.aiMessage,
  timestamp: new Date(),
  shouldTransition: turnResult.shouldTransition,  // ← ADD THIS LINE
};
```

**Evidence**: Pattern from `turnResult` (line 57) which already contains `shouldTransition` field from `processConversationTurn` return value.

**Done When**:
- Return statement includes `shouldTransition: turnResult.shouldTransition`
- File compiles without TypeScript errors
- No other code changes in this file

---

### PLAN-002: Update TypeScript Type Definition for sendMessage

**Change Type**: modify

**File**: `src/shared/types/electron.d.ts`

**Instruction**:

1. Open `src/shared/types/electron.d.ts`
2. Locate the `ConversationAPI` interface (line 8)
3. Find the `sendMessage` method signature (lines 10-13)
4. Add `shouldTransition?: boolean` to the return type

**Current Code** (lines 10-13):
```typescript
sendMessage: (
  sessionId: string,
  message: string
) => Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }>;
```

**Required Change**:
```typescript
sendMessage: (
  sessionId: string,
  message: string
) => Promise<{
  success: boolean;
  aiMessage?: string;
  timestamp?: Date;
  shouldTransition?: boolean;  // ← ADD THIS LINE
  error?: string;
}>;
```

**Rationale**: Field is optional (`?`) because error responses won't include it.

**Evidence**: Pattern from `getSuggestions` return type (line 15) which already uses optional fields.

**Done When**:
- Type definition includes `shouldTransition?: boolean`
- File compiles without TypeScript errors
- All references to `sendMessage` result can access `shouldTransition` property

---

### PLAN-003: Update ConversationPage to Handle Transition

**Change Type**: modify

**File**: `src/renderer/pages/ConversationPage.tsx`

**Instruction**:

1. Open `src/renderer/pages/ConversationPage.tsx`
2. Locate the `handleSend` function (line 196)
3. After dispatching the AI message (line 208-212), add transition detection logic
4. If `result.shouldTransition` is true, call `getSuggestions` and display results

**Current Code** (lines 203-216):
```typescript
const result = await window.electron.conversationAPI.sendMessage(
  state.sessionId,
  messageContent
);
if (result.success && result.aiMessage) {
  dispatch({
    type: 'add_ai_message',
    content: result.aiMessage,
    timestamp: result.timestamp || new Date(),
  });
} else {
  dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
}
```

**Required Change**:
```typescript
const result = await window.electron.conversationAPI.sendMessage(
  state.sessionId,
  messageContent
);
if (result.success && result.aiMessage) {
  dispatch({
    type: 'add_ai_message',
    content: result.aiMessage,
    timestamp: result.timestamp || new Date(),
  });

  // ← ADD THIS BLOCK: Check if AI wants to show suggestions
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
          content: suggestionsResult.aiMessage || 'Here are some recipes for you:',
          timestamp: new Date(),
          suggestions: suggestionsResult.suggestions.suggestions,
        });
      } else {
        // Display error if suggestion fetch failed
        dispatch({
          type: 'set_error',
          error: suggestionsResult.error || 'Failed to fetch suggestions',
        });
      }
    } catch (error) {
      dispatch({
        type: 'set_error',
        error: 'Failed to fetch suggestions. Please try again.',
      });
    } finally {
      dispatch({ type: 'set_loading', isLoading: false });
    }
  }
} else {
  dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
}
```

**Rationale**:
- Loading state prevents user from sending messages while fetching suggestions
- Error handling ensures user gets feedback if suggestions fail
- Uses existing `add_ai_message_with_suggestions` action (already implemented in Phase 3)
- `suggestionsResult.suggestions.suggestions` unwraps the nested structure (outer is `SuggestionResult`, inner is array)

**Evidence**: 
- Action type `add_ai_message_with_suggestions` exists at line 38-43
- `getSuggestions` API method exists at line 15 in electron.d.ts
- Loading state management pattern from lines 99-102

**Done When**:
- Code checks for `result.shouldTransition`
- Code calls `getSuggestions` when transition detected
- Loading state is set during suggestion fetch
- Error handling covers fetch failures
- Suggestions are displayed using existing reducer action
- File compiles without TypeScript errors

---

### PLAN-004: Add Unit Test for shouldTransition Return

**Change Type**: modify

**File**: `src/main/ipc/conversation-handlers.test.ts`

**Instruction**:

1. Open `src/main/ipc/conversation-handlers.test.ts`
2. Locate the test "transitions state when AI signals readiness" (line 155)
3. Add assertion to verify `shouldTransition` is returned in the result

**Current Test** (lines 180-185):
```typescript
const result = await messageHandlerFn(event, 'test-session-123', 'About 30 minutes');

expect(result.success).toBe(true);

// Verify user context was updated
const { updateUserContext } = await import('../conversation/session-manager.js');
```

**Required Addition** (insert after line 184):
```typescript
expect(result.success).toBe(true);
expect(result.shouldTransition).toBe(true);  // ← ADD THIS LINE

// Verify user context was updated
const { updateUserContext } = await import('../conversation/session-manager.js');
```

**Instruction** (continued):

4. Also verify `shouldTransition: false` case in the first test (line 105)
5. Add assertion after line 135

**Current Test** (lines 133-136):
```typescript
expect(result.success).toBe(true);
expect(result.aiMessage).toBe('How are you feeling today?');
expect(result.timestamp).toBeInstanceOf(Date);
```

**Required Addition**:
```typescript
expect(result.success).toBe(true);
expect(result.aiMessage).toBe('How are you feeling today?');
expect(result.timestamp).toBeInstanceOf(Date);
expect(result.shouldTransition).toBe(false);  // ← ADD THIS LINE
```

**Evidence**: Test pattern from existing assertions at lines 133-136.

**Done When**:
- Test verifies `shouldTransition: true` is returned when AI signals transition
- Test verifies `shouldTransition: false` is returned when AI doesn't signal transition
- All tests pass (`npm test conversation-handlers.test.ts`)

---

### PLAN-005: Add Component Test for Transition Handling

**Change Type**: create

**File**: `src/renderer/pages/ConversationPage.test.tsx`

**Instruction**:

Create a new test file to verify ConversationPage handles the transition correctly.

**Full Test File**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationPage } from './ConversationPage';

// Mock window.electron API
const mockSendMessage = vi.fn();
const mockGetSuggestions = vi.fn();
const mockStartSession = vi.fn();
const mockAbandonSession = vi.fn();
const mockGetById = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Setup window.electron mock
  global.window.electron = {
    platform: 'test',
    versions: { node: '22.0.0', chrome: '130.0.0', electron: '39.0.0' },
    conversationAPI: {
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      abandonSession: mockAbandonSession,
      getSuggestions: mockGetSuggestions,
      rejectRecipe: vi.fn(),
      refine: vi.fn(),
    },
    recipeAPI: {
      create: vi.fn(),
      getAll: vi.fn(),
      getById: mockGetById,
      filter: vi.fn(),
      generateRecipe: vi.fn(),
      importRecipe: vi.fn(),
    },
  };

  // Default: startSession returns success
  mockStartSession.mockResolvedValue({
    success: true,
    sessionId: 'test-session-123',
  });
});

describe('ConversationPage - Transition Handling', () => {
  it('should fetch and display suggestions when AI signals transition', async () => {
    // Setup: Mock sendMessage to return shouldTransition: true
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      aiMessage: 'Great! Let me find some recipes for you.',
      timestamp: new Date(),
      shouldTransition: true,
    });

    // Setup: Mock getSuggestions to return recipe suggestions
    mockGetSuggestions.mockResolvedValueOnce({
      success: true,
      aiMessage: 'Here are some recipes I think you'll love:',
      suggestions: {
        suggestions: [
          {
            recipeId: 'recipe-123',
            relevanceScore: 95,
            reasoning: 'Perfect match for low energy and time constraints.',
            matchedFactors: ['quick', 'low-energy', 'one-pot'],
          },
        ],
      },
    });

    // Setup: Mock getById to return recipe details
    mockGetById.mockResolvedValue({
      success: true,
      recipe: {
        id: 'recipe-123',
        title: 'Quick One-Pot Pasta',
        cookingTimeMinutes: 20,
        prepTimeMinutes: 5,
        totalTimeMinutes: 25,
        cookwareType: 'one-pot',
        servings: 2,
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'ai-generated',
        sourceReference: null,
        instructions: 'Cook pasta with sauce.',
        ingredients: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Render component
    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // User sends message
    const input = screen.getByPlaceholderText(/tell me about your day/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'I have 30 minutes');
    await userEvent.click(sendButton);

    // Verify: sendMessage was called
    expect(mockSendMessage).toHaveBeenCalledWith('test-session-123', 'I have 30 minutes');

    // Verify: AI message appears
    await waitFor(() => {
      expect(screen.getByText(/Great! Let me find some recipes for you./i)).toBeInTheDocument();
    });

    // Verify: getSuggestions was called automatically
    expect(mockGetSuggestions).toHaveBeenCalledWith('test-session-123');

    // Verify: Suggestion message appears
    await waitFor(() => {
      expect(
        screen.getByText(/Here are some recipes I think you'll love:/i)
      ).toBeInTheDocument();
    });

    // Verify: Recipe card appears (title from mocked recipe)
    await waitFor(() => {
      expect(screen.getByText(/Quick One-Pot Pasta/i)).toBeInTheDocument();
    });
  });

  it('should NOT fetch suggestions when AI does not signal transition', async () => {
    // Setup: Mock sendMessage to return shouldTransition: false
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      aiMessage: 'Tell me more about your preferences.',
      timestamp: new Date(),
      shouldTransition: false,
    });

    // Render component
    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // User sends message
    const input = screen.getByPlaceholderText(/tell me about your day/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello');
    await userEvent.click(sendButton);

    // Verify: sendMessage was called
    expect(mockSendMessage).toHaveBeenCalledWith('test-session-123', 'Hello');

    // Verify: AI message appears
    await waitFor(() => {
      expect(screen.getByText(/Tell me more about your preferences./i)).toBeInTheDocument();
    });

    // Verify: getSuggestions was NOT called
    expect(mockGetSuggestions).not.toHaveBeenCalled();
  });

  it('should display error if getSuggestions fails', async () => {
    // Setup: Mock sendMessage to return shouldTransition: true
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      aiMessage: 'Let me find recipes.',
      timestamp: new Date(),
      shouldTransition: true,
    });

    // Setup: Mock getSuggestions to fail
    mockGetSuggestions.mockResolvedValueOnce({
      success: false,
      error: 'No recipes match your constraints',
    });

    // Render component
    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // User sends message
    const input = screen.getByPlaceholderText(/tell me about your day/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Show me recipes');
    await userEvent.click(sendButton);

    // Verify: Error message appears
    await waitFor(() => {
      expect(screen.getByText(/No recipes match your constraints/i)).toBeInTheDocument();
    });
  });
});
```

**Evidence**: Test pattern from `RecipeSuggestionCard.test.tsx` (lines 1-100) and `FeedbackDialog.test.tsx`.

**Done When**:
- Test file created with 3 comprehensive test cases
- Tests verify transition detection and getSuggestions call
- Tests verify no fetch when shouldTransition is false
- Tests verify error handling
- All tests pass (`npm test ConversationPage.test.tsx`)

---

### PLAN-006: Add Integration Test for Full Flow

**Change Type**: modify

**File**: `src/main/ipc/conversation-handlers.test.ts`

**Instruction**:

Add a new integration test that verifies the complete flow from conversation → transition → suggestions.

1. Open `src/main/ipc/conversation-handlers.test.ts`
2. Add a new test in the "Conversation Flow (Phase 2)" describe block (after line 342)

**New Test to Add**:
```typescript
it('should support transition to suggestions after gathering context', async () => {
  // Setup: Mock getSession to return a valid session
  const { getSession, updateUserContext, updateSessionState } =
    await import('../conversation/session-manager.js');
  vi.mocked(getSession).mockReturnValue({
    sessionId: 'test-session-123',
    messages: [],
    userContext: { energyLevel: 'low', availableTime: 30 },
    suggestedRecipes: [],
    rejectedRecipes: [],
    state: 'gathering',
    turnCount: 0,
    refinementCount: 0,
    turnsInCurrentState: 0,
    createdAt: new Date(),
    lastActivity: new Date(),
  });

  // Setup: Mock processConversationTurn to signal transition
  const { processConversationTurn } = await import('../conversation/conversation-service.js');
  vi.mocked(processConversationTurn).mockResolvedValueOnce({
    aiMessage: 'Perfect! Let me find some recipes.',
    extractedContext: {},
    shouldTransition: true,
  });

  const event = { senderFrame: { url: 'file://test' } };
  if (!messageHandlerFn) throw new Error('messageHandlerFn not initialized');

  // Execute: User confirms they want recipes
  const result = await messageHandlerFn(event, 'test-session-123', 'Yes, show me recipes');

  // Verify: Handler returned shouldTransition: true
  expect(result.success).toBe(true);
  expect(result.shouldTransition).toBe(true);
  expect(result.aiMessage).toBe('Perfect! Let me find some recipes.');

  // Verify: State was transitioned to 'suggesting'
  expect(updateSessionState).toHaveBeenCalledWith('test-session-123', 'suggesting');

  // Note: Frontend is responsible for calling getSuggestions when it sees shouldTransition: true
  // This test verifies the backend correctly signals the transition
});
```

**Evidence**: Test pattern from existing integration test at lines 257-342.

**Done When**:
- Test added to conversation-handlers.test.ts
- Test verifies `shouldTransition: true` is returned
- Test verifies state transition occurs
- All tests pass (`npm test conversation-handlers.test.ts`)

---

### PLAN-007: Add E2E Test for User-Visible Behavior

**Change Type**: create

**File**: `e2e/conversation-suggestions.spec.ts`

**Instruction**:

Create an end-to-end test that verifies the complete user experience.

**Full E2E Test File**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Conversation to Suggestions Flow', () => {
  test('should display recipe suggestions after conversation', async ({ page }) => {
    // Navigate to conversation page
    await page.goto('/');
    await page.click('text=What\'s for dinner?');

    // Wait for conversation to load
    await expect(page.locator('h1')).toContainText("What's for dinner?");

    // Simulate conversation: Answer energy level question
    const input = page.locator('input[placeholder*="Tell me about your day"]');
    const sendButton = page.locator('button:has-text("Send")');

    await input.fill("I'm feeling pretty tired tonight");
    await sendButton.click();

    // Wait for AI response
    await expect(page.locator('text=/time do you have/i')).toBeVisible({ timeout: 10000 });

    // Simulate conversation: Answer time question
    await input.fill('About 30 minutes');
    await sendButton.click();

    // Wait for AI to transition and show suggestions
    // This should happen automatically when AI detects sufficient context
    await expect(page.locator('text=/Here are some recipes/i')).toBeVisible({ timeout: 15000 });

    // Verify: Recipe cards are displayed
    await expect(page.locator('[data-testid="recipe-suggestion-card"]').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify: Recipe card has expected elements
    const firstCard = page.locator('[data-testid="recipe-suggestion-card"]').first();
    await expect(firstCard.locator('h3')).toBeVisible(); // Recipe title
    await expect(firstCard.locator('text=/min/i')).toBeVisible(); // Time indicator
    await expect(firstCard.locator('button:has-text("Select this recipe")')).toBeVisible();
    await expect(firstCard.locator('button:has-text("Not this one")')).toBeVisible();
  });

  test('should continue conversation if AI needs more info', async ({ page }) => {
    // Navigate to conversation page
    await page.goto('/');
    await page.click('text=What\'s for dinner?');

    // Wait for conversation to load
    await expect(page.locator('h1')).toContainText("What's for dinner?");

    // Send a vague message
    const input = page.locator('input[placeholder*="Tell me about your day"]');
    const sendButton = page.locator('button:has-text("Send")');

    await input.fill('Hello');
    await sendButton.click();

    // Wait for AI response asking for more info
    await expect(page.locator('.bg-gray-200').last()).toBeVisible({ timeout: 10000 });

    // Verify: NO recipe suggestions appear (AI still gathering context)
    await expect(page.locator('[data-testid="recipe-suggestion-card"]')).not.toBeVisible();

    // Verify: Conversation continues normally
    const aiMessages = page.locator('.bg-gray-200');
    await expect(aiMessages).toHaveCount(1); // Only one AI message so far
  });
});
```

**Evidence**: E2E test pattern from `e2e/manual-entry.spec.ts` and `e2e/ai-recipe-generation.spec.ts`.

**Important Notes**:
- This E2E test requires a valid `OPENAI_API_KEY` in `.env` file
- Test uses real AI responses, so may be flaky (acceptable for E2E tests)
- Consider marking as `test.skip()` in CI environment if API key is not available
- Test verifies the COMPLETE user-facing behavior, not just unit logic

**Done When**:
- E2E test file created with 2 test cases
- Test verifies recipe cards appear after conversation
- Test verifies conversation continues if AI needs more info
- Tests pass locally with valid API key (`npx playwright test conversation-suggestions.spec.ts`)

---

## Acceptance Criteria

### Functional Criteria

- [ ] User can have a conversation with the AI to gather context
- [ ] When AI has sufficient context (energyLevel + availableTime), suggestions appear automatically
- [ ] Recipe suggestion cards display immediately after AI signals readiness
- [ ] User does NOT need to manually trigger suggestion fetching
- [ ] If suggestion fetch fails, user sees a clear error message
- [ ] Conversation can continue normally if AI doesn't have enough context yet

### Technical Criteria

- [ ] `shouldTransition` flag returned from `conversation:sendMessage` IPC handler
- [ ] TypeScript type definitions updated for `sendMessage` return type
- [ ] `ConversationPage.tsx` checks `shouldTransition` and calls `getSuggestions()`
- [ ] Loading state displayed while fetching suggestions
- [ ] Error handling for failed suggestion fetch
- [ ] No race conditions when user sends messages rapidly

### Testing Criteria

- [ ] Unit test verifies `shouldTransition: true` returned when AI signals transition
- [ ] Unit test verifies `shouldTransition: false` returned when AI doesn't signal transition
- [ ] Component test verifies `getSuggestions()` called when transition detected
- [ ] Component test verifies NO fetch when `shouldTransition` is false
- [ ] Component test verifies error handling for failed suggestion fetch
- [ ] Integration test verifies full backend flow (conversation → transition → state change)
- [ ] E2E test verifies user sees recipe cards after conversation
- [ ] All existing tests still pass (no regressions)

---

## Implementor Checklist

- [ ] PLAN-001: Update IPC handler to return shouldTransition
- [ ] PLAN-002: Update TypeScript type definition for sendMessage
- [ ] PLAN-003: Update ConversationPage to handle transition
- [ ] PLAN-004: Add unit test for shouldTransition return
- [ ] PLAN-005: Add component test for transition handling
- [ ] PLAN-006: Add integration test for full flow
- [ ] PLAN-007: Add E2E test for user-visible behavior
- [ ] Verify all acceptance criteria met
- [ ] Run full test suite and confirm passing
- [ ] Manual smoke test in app UI
- [ ] Update STATE file with completion status

---

## Dependencies

### Prerequisites (Must Exist)

- ✅ `processConversationTurn` returns `shouldTransition` field
- ✅ `conversation:getSuggestions` IPC handler exists and works
- ✅ `ConversationPage` reducer supports `add_ai_message_with_suggestions` action
- ✅ `RecipeSuggestionCard` component exists and renders correctly
- ✅ Session state transitions work (`gathering` → `suggesting`)

### Blockers

None - all infrastructure already exists from Phase 3 and Phase 4.

---

## Risk Assessment

### Low Risk

- **Change scope**: Very small (3 files, ~40 lines of code)
- **Backward compatibility**: No breaking changes to existing API contracts
- **Existing infrastructure**: All required components already exist and work

### Medium Risk

- **AI timing**: AI might signal transition at unexpected times (mitigated by comprehensive tests)
- **Error handling**: Suggestion fetch could fail (mitigated by try-catch and error display)

### Mitigation Strategies

1. **Comprehensive testing**: Unit + Component + Integration + E2E tests cover all cases
2. **Error boundaries**: User gets clear feedback if anything fails
3. **Loading states**: User knows when system is working on their request

---

## Post-Implementation Verification

After all tasks complete, verify with:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run all unit tests
npm test

# Run specific test suites
npm test conversation-handlers.test.ts
npm test ConversationPage.test.tsx

# Run E2E test (requires OPENAI_API_KEY in .env)
npx playwright test conversation-suggestions.spec.ts

# Manual verification (critical!)
npm run dev
# 1. Navigate to "What's for dinner?" page
# 2. Have a conversation: "I'm tired" → "30 minutes"
# 3. Verify recipe suggestions appear automatically
# 4. Verify NO manual button click needed
# 5. Try rejecting a recipe and verify refinement works
```

---

## Notes

- **Priority**: CRITICAL - Feature is completely broken without this fix
- **Estimated Time**: 2-4 hours (small code changes, but comprehensive testing)
- **User Impact**: HIGH - Unlocks the entire conversational decision support feature

---

**Plan Created**: 2026-01-07  
**Status**: Ready for Implementation  
**Assignee**: Implementor Agent
