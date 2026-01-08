# Conversation E2E Mocks Implementation Plan

## Inputs
- **Research report:** `thoughts/shared/research/2026-01-08-conversation-test-failures.md`
- **User request:** Create plan for E2E mock implementation (not code implementation)
- **Reference implementations:**
  - `src/main/ipc/recipe-ai-handlers.ts` (IPC handler with E2E detection)
  - `src/main/ipc/recipe-ai-handlers.mock.ts` (420-line mock implementation)
  - `src/main/ipc/recipe-import-handlers.mock.ts` (similar pattern)
  - `src/main/utils/test-env.ts` (isE2ETest utility)

## Verified Current State

### Conversation Flow Architecture (Verified)

**Fact:** The conversation feature has 3 main IPC endpoints
**Evidence:** `src/main/ipc/conversation-handlers.ts:36-160`
**Excerpt:**
```typescript
ipcMain.handle('conversation:start', async event => { ... });
ipcMain.handle('conversation:sendMessage', async (event, sessionId, message) => { ... });
ipcMain.handle('conversation:get-suggestions', async (event, sessionId) => { ... });
ipcMain.handle('conversation:reject-recipe', async (event, sessionId, recipeId, reason?) => { ... });
ipcMain.handle('conversation:refine', async (event, sessionId) => { ... });
ipcMain.handle('conversation:abandon', async (event, sessionId) => { ... });
```

**Fact:** Conversation service has 3 main functions that call OpenAI
**Evidence:** `src/main/conversation/conversation-service.ts:64-303`
1. `processConversationTurn()` - Gathers user context via AI conversation (lines 64-132)
2. `transitionToSuggesting()` - Calls getRankedSuggestions which uses AI ranking (lines 142-199)
3. `processRefinement()` - Re-ranks recipes after rejection (lines 209-303)

**Fact:** Recipe ranker uses OpenAI for ranking
**Evidence:** `src/main/conversation/recipe-ranker.ts:46-113`
```typescript
export async function getRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput> {
  // ... candidate selection ...
  const client = getOpenAIClient();
  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: zodResponseFormat(RecipeSuggestionSchema, 'recipe_suggestions'),
  });
  // ...
}
```

### Test Expectations (Verified)

**Fact:** Test 1 expects specific conversation flow
**Evidence:** `e2e/conversation-suggestions.spec.ts:5-53`
1. User: "I'm feeling pretty tired tonight" → AI should ask about time
2. User: "About 30 minutes" → AI should transition with "Here are some recipes"
3. Recipe cards should appear with suggestions

**Fact:** Test 2 expects conversation to continue without suggestions
**Evidence:** `e2e/conversation-suggestions.spec.ts:55-90`
1. User: "Hello" → AI should ask for more info (no transition)
2. Only 1 AI message should appear (via specific selector)
3. No recipe suggestions should appear

### Existing Mock Pattern (Verified)

**Fact:** Recipe generation uses isE2ETest() check
**Evidence:** `src/main/ipc/recipe-ai-handlers.ts:36-42`
```typescript
// Generate recipe via OpenAI or use mock in E2E test environment
const result = isE2ETest()
  ? await mockGenerateRecipe(criteria)
  : await generateRecipe(criteria);

// TEMP: Verify which path was taken
console.log('AI handler using:', isE2ETest() ? 'MOCK' : 'REAL');
```

**Fact:** Mock implementation uses test signals for error scenarios
**Evidence:** `src/main/ipc/recipe-ai-handlers.mock.ts:45-81`
```typescript
export async function mockGenerateRecipe(
  criteria: RecipeGenerationCriteria
): Promise<RecipeGenerationResult> {
  // Detect test signals for error simulation
  if (criteria.mainIngredient === 'rate-limit-test') {
    return { success: false, error: { type: 'rate-limit', ... } };
  }
  if (criteria.mainIngredient === 'invalid-test') {
    return { success: false, error: { type: 'validation', ... } };
  }
  if (criteria.mainIngredient === 'failure-test') {
    return { success: false, error: { type: 'unknown', ... } };
  }
  // Generate successful mock recipe based on criteria
  const recipe = generateMockRecipe(criteria);
  return { success: true, recipe };
}
```

## Goals / Non-Goals

### Goals
1. Implement E2E mocks for conversation feature following established patterns
2. Make all conversation E2E tests pass reliably without OpenAI API
3. Support test signals for error scenario testing
4. Maintain deterministic test behavior
5. Preserve full type compatibility with real implementations

### Non-Goals
1. Change the real conversation service implementation
2. Modify OpenAI integration for production use
3. Create unit test mocks (only E2E mocks)
4. Refactor existing test assertions (only make them pass)
5. Change the conversation flow architecture

## Design Overview

### High-Level Approach

The implementation follows the **exact same pattern** as recipe generation mocking:

1. **Create mock conversation service** (`conversation-service.mock.ts`)
   - Mock `processConversationTurn()` - Returns deterministic AI responses
   - Mock `transitionToSuggesting()` - Returns deterministic recipe suggestions
   - Mock `processRefinement()` - Returns refinement results

2. **Create mock recipe ranker** (`recipe-ranker.mock.ts`)
   - Mock `getRankedSuggestions()` - Returns pre-defined recipe suggestions

3. **Add E2E detection to IPC handlers** (`conversation-handlers.ts`)
   - Check `isE2ETest()` before calling real services
   - Route to mock services in E2E mode

4. **Design deterministic conversation flows**
   - Map specific user inputs to specific AI responses
   - Ensure test expectations are met
   - Support test signals for error scenarios

### Data Flow (E2E Mode)

```
User Input → IPC Handler → isE2ETest() check → Mock Service → Deterministic Response
                              ↓
                         (real service bypassed)
```

### Mock Conversation State Machine

```
State: gathering
  Input: "I'm feeling pretty tired tonight"
    → Extract: { energyLevel: 'low' }
    → Response: "I hear you! How much time do you have? 30 minutes? 45?"
    → shouldTransition: false

  Input: "About 30 minutes"
    → Extract: { energyLevel: 'low', availableTime: 30 }
    → Response: "Perfect! With low energy and 30 minutes, let me find you some quick and easy recipes!"
    → shouldTransition: true

State: suggesting
  → getSuggestions() returns 2-4 pre-defined recipes
  → aiMessage: "Here are some recipes I think you'll love:"

State: refining (after rejection)
  → Returns different set of pre-defined recipes
```

## Implementation Instructions (For Implementor)

---

### PLAN-001: Create Mock Conversation Service

**Action ID:** PLAN-001  
**Change Type:** create  
**File(s):** `src/main/conversation/conversation-service.mock.ts`

**Instruction:**

1. Create new file `src/main/conversation/conversation-service.mock.ts`
2. Import required types from `conversation-schema.ts` and `conversation.ts`
3. Implement `mockProcessConversationTurn(sessionId: string, userMessage: string): Promise<ConversationTurnOutput>`
   - This function replaces `processConversationTurn()` in E2E tests
   - Use pattern matching on `userMessage` to return deterministic responses
   - Maintain conversation state in session via `session-manager.ts` (add user/AI messages)
   - Extract context based on keywords in user message
   - Return `shouldTransition: true` when energyLevel AND availableTime are extracted

4. Implement deterministic response mapping:
   ```
   User input pattern → AI response
   
   /tired|low energy|exhausted/i → 
     { energyLevel: 'low', aiMessage: "I hear you! How much time do you have? 30 minutes? 45?", shouldTransition: false }
   
   /30 minutes?|about 30|thirty/i (when energyLevel exists) →
     { availableTime: 30, aiMessage: "Perfect! With low energy and 30 minutes, let me find you some quick and easy recipes!", shouldTransition: true }
   
   /hello|hi|hey/i (no context yet) →
     { aiMessage: "Hi! How's your energy level tonight? Feeling up for some cooking or need something really simple?", shouldTransition: false }
   
   Default (unrecognized input) →
     { aiMessage: "I'd love to help! Could you tell me how you're feeling energy-wise tonight?", shouldTransition: false }
   ```

5. Support test signals for error scenarios:
   ```
   userMessage === 'MOCK_API_ERROR' → throw Error('OpenAI API unavailable')
   userMessage === 'MOCK_INVALID_SESSION' → throw Error('Session not found')
   ```

6. Call session-manager functions to maintain state:
   - `updateSessionMessages()` to add user and AI messages
   - `updateUserContext()` to store extracted context
   - `setSessionTransitionMessage()` when shouldTransition=true

**Interfaces / Pseudocode:**

```typescript
import type { ConversationTurnOutput } from './conversation-schema.js';
import { getSession, updateSessionMessages, updateUserContext, setSessionTransitionMessage } from './session-manager.js';

export async function mockProcessConversationTurn(
  sessionId: string,
  userMessage: string
): Promise<ConversationTurnOutput> {
  // 1. Validate session exists
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  
  // 2. Test signal detection
  if (userMessage === 'MOCK_API_ERROR') {
    throw new Error('OpenAI API unavailable');
  }
  
  // 3. Add user message to session
  updateSessionMessages(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  });
  
  // 4. Pattern matching to extract context and generate response
  const extractedContext = {};
  let aiMessage = '';
  let shouldTransition = false;
  
  // Pattern: Low energy / tired
  if (/tired|low energy|exhausted/i.test(userMessage)) {
    extractedContext.energyLevel = 'low';
    aiMessage = "I hear you! How much time do you have? 30 minutes? 45?";
  }
  // Pattern: Time mention (when energyLevel exists)
  else if (/30\s*minutes?|about\s*30|thirty/i.test(userMessage) && session.userContext.energyLevel) {
    extractedContext.availableTime = 30;
    aiMessage = "Perfect! With low energy and 30 minutes, let me find you some quick and easy recipes!";
    shouldTransition = true;
  }
  // Pattern: Greeting without context
  else if (/hello|hi|hey/i.test(userMessage)) {
    aiMessage = "Hi! How's your energy level tonight? Feeling up for some cooking or need something really simple?";
  }
  // Default
  else {
    aiMessage = "I'd love to help! Could you tell me how you're feeling energy-wise tonight?";
  }
  
  // 5. Update session with extracted context
  if (Object.keys(extractedContext).length > 0) {
    updateUserContext(sessionId, extractedContext);
  }
  
  // 6. Add AI message to session
  updateSessionMessages(sessionId, {
    role: 'assistant',
    content: aiMessage,
    timestamp: new Date(),
  });
  
  // 7. Store transition message if transitioning
  if (shouldTransition) {
    setSessionTransitionMessage(sessionId, aiMessage);
  }
  
  return {
    aiMessage,
    extractedContext,
    shouldTransition,
    reasoning: 'Mock conversation turn',
  };
}
```

**Evidence:** Pattern based on real prompts at `src/main/conversation/prompts.ts:19-76`

**Done When:**
- File `src/main/conversation/conversation-service.mock.ts` exists
- Function `mockProcessConversationTurn()` is exported
- Function handles patterns matching test expectations
- Function maintains session state via session-manager
- Test signals for errors are supported

---

### PLAN-002: Create Mock Recipe Ranker

**Action ID:** PLAN-002  
**Change Type:** create  
**File(s):** `src/main/conversation/recipe-ranker.mock.ts`

**Instruction:**

1. Create new file `src/main/conversation/recipe-ranker.mock.ts`
2. Import required types from `ranking-schema.ts` and `conversation.ts`
3. Implement `mockGetRankedSuggestions(sessionId: string): Promise<RecipeSuggestionOutput>`
   - This function replaces `getRankedSuggestions()` in E2E tests
   - Returns 2-4 pre-defined recipe suggestions
   - Recipes should exist in the seeded E2E database
   - Vary suggestions based on user context (energyLevel, availableTime)

4. Define pre-seeded recipe sets:
   ```
   Low energy + 30 min → Quick, simple recipes (e.g., stir-fry, pasta)
   Medium energy + 45 min → Standard recipes (e.g., curry, baked dishes)
   High energy + 60 min → Complex recipes (e.g., multi-component meals)
   ```

5. Return deterministic recipe IDs that exist in test database:
   - Use recipe IDs from `src/main/database/seed.ts` (test seed data)
   - Or use well-known recipe IDs that are guaranteed to exist

6. Format response according to `RecipeSuggestionSchema`:
   ```typescript
   {
     suggestions: [
       {
         recipeId: 'uuid-of-test-recipe-1',
         relevanceScore: 95,
         reasoning: 'Quick stir-fry perfect for low energy cooking',
         matchedFactors: ['Low energy', '30 minutes', 'One-pot']
       },
       // ... 1-3 more suggestions
     ]
   }
   ```

7. Support test signals:
   ```
   Session userContext contains { mock_error: 'NO_RECIPES' } → 
     throw Error('No suitable recipes found')
   ```

**Interfaces / Pseudocode:**

```typescript
import type { RecipeSuggestionOutput } from './ranking-schema.js';
import { getSession } from './session-manager.js';

// Pre-defined recipe sets for different contexts
const MOCK_RECIPE_SUGGESTIONS = {
  lowEnergy30Min: [
    {
      recipeId: 'test-recipe-stir-fry-001',
      relevanceScore: 95,
      reasoning: 'Quick vegetable stir-fry perfect for low energy cooking. Minimal prep, one-pan simplicity.',
      matchedFactors: ['Low energy', '30 minutes', 'One-pot', 'Minimal prep']
    },
    {
      recipeId: 'test-recipe-pasta-002',
      relevanceScore: 90,
      reasoning: 'Simple pasta dish ready in 30 minutes. Very little active cooking time.',
      matchedFactors: ['Low energy', '30 minutes', 'Quick cooking']
    }
  ],
  mediumEnergy45Min: [
    // ... similar structure
  ],
  default: [
    // ... fallback recipes
  ]
};

export async function mockGetRankedSuggestions(
  sessionId: string
): Promise<RecipeSuggestionOutput> {
  // 1. Get session to check context
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  
  // 2. Test signal detection
  if (session.userContext.mock_error === 'NO_RECIPES') {
    throw new Error('No suitable recipes found');
  }
  
  // 3. Select recipe set based on context
  const { energyLevel, availableTime } = session.userContext;
  let suggestions;
  
  if (energyLevel === 'low' && availableTime <= 30) {
    suggestions = MOCK_RECIPE_SUGGESTIONS.lowEnergy30Min;
  } else if (energyLevel === 'medium' && availableTime <= 45) {
    suggestions = MOCK_RECIPE_SUGGESTIONS.mediumEnergy45Min;
  } else {
    suggestions = MOCK_RECIPE_SUGGESTIONS.default;
  }
  
  return { suggestions };
}
```

**Evidence:** Schema at `src/main/conversation/ranking-schema.ts:1-18`  
**Evidence:** Real implementation at `src/main/conversation/recipe-ranker.ts:46-113`

**Done When:**
- File `src/main/conversation/recipe-ranker.mock.ts` exists
- Function `mockGetRankedSuggestions()` is exported
- Function returns deterministic suggestions based on user context
- Recipe IDs correspond to seeded test data
- Test signals for errors are supported

---

### PLAN-003: Create Mock Refinement Function

**Action ID:** PLAN-003  
**Change Type:** modify  
**File(s):** `src/main/conversation/conversation-service.mock.ts` (extend from PLAN-001)

**Instruction:**

1. Add `mockProcessRefinement(sessionId: string): Promise<SuggestionResult>` to the mock service
2. This replaces `processRefinement()` in E2E tests
3. Check session's `rejectedRecipes` list
4. Return different recipe suggestions that exclude rejected recipes
5. Track refinement count and return escalation message after 3 refinements

**Interfaces / Pseudocode:**

```typescript
import type { SuggestionResult } from './conversation-service.js';

export async function mockProcessRefinement(
  sessionId: string
): Promise<SuggestionResult> {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  
  // Check if max refinements reached (3)
  if (session.refinementCount >= 3) {
    return {
      success: true,
      aiMessage: "I've shown you quite a few options. Would you like to browse recipes by category instead?",
      suggestions: [], // Escalation - no more suggestions
    };
  }
  
  // Get new suggestions excluding rejected recipes
  const allSuggestions = MOCK_RECIPE_SUGGESTIONS.lowEnergy30Min; // Simplified
  const rejectedIds = session.rejectedRecipes.map(r => r.recipeId);
  const filteredSuggestions = allSuggestions.filter(s => !rejectedIds.includes(s.recipeId));
  
  return {
    success: true,
    aiMessage: "Let me find you some different options!",
    suggestions: filteredSuggestions.slice(0, 3),
  };
}
```

**Evidence:** Real implementation at `src/main/conversation/conversation-service.ts:209-303`  
**Evidence:** Refinement limit check at line 224

**Done When:**
- Function `mockProcessRefinement()` is exported from mock service
- Function respects 3-refinement limit
- Function excludes rejected recipes from new suggestions
- Function returns escalation message after limit

---

### PLAN-004: Add E2E Detection to Conversation IPC Handlers

**Action ID:** PLAN-004  
**Change Type:** modify  
**File(s):** `src/main/ipc/conversation-handlers.ts`

**Instruction:**

1. Import `isE2ETest` utility at the top of the file:
   ```typescript
   import { isE2ETest } from '../utils/test-env.js';
   ```

2. Import mock functions:
   ```typescript
   import { mockProcessConversationTurn, mockProcessRefinement } from '../conversation/conversation-service.mock.js';
   import { mockGetRankedSuggestions } from '../conversation/recipe-ranker.mock.js';
   ```

3. Modify `conversation:sendMessage` handler (currently at lines 45-85):
   - Before calling `processConversationTurn()`, check `isE2ETest()`
   - If true, call `mockProcessConversationTurn()` instead
   - Keep all other logic identical (context updates, state transitions)

4. Modify `conversation:get-suggestions` handler (currently at lines 141-160):
   - The real `transitionToSuggesting()` function internally calls `getRankedSuggestions()`
   - Create a mock version of `transitionToSuggesting()` OR
   - Check `isE2ETest()` and call mock ranker directly

5. Modify `conversation:refine` handler (currently at lines 111-130):
   - Before calling `processRefinement()`, check `isE2ETest()`
   - If true, call `mockProcessRefinement()` instead

6. Add debug logging (follow pattern from recipe-ai-handlers.ts:42):
   ```typescript
   console.log('Conversation handler using:', isE2ETest() ? 'MOCK' : 'REAL');
   ```

**Interfaces / Pseudocode:**

For `conversation:sendMessage` handler:
```typescript
ipcMain.handle('conversation:sendMessage', async (event, sessionId: string, message: string) => {
  if (!event.senderFrame || !validateSender(event.senderFrame)) {
    return { success: false, error: 'Unauthorized IPC sender' };
  }

  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  try {
    // E2E detection: Use mock or real service
    const turnResult = isE2ETest()
      ? await mockProcessConversationTurn(sessionId, message)
      : await processConversationTurn(sessionId, message);
    
    console.log('Conversation handler using:', isE2ETest() ? 'MOCK' : 'REAL');

    // Update session context if AI extracted new information
    const extractedContext = Object.fromEntries(
      Object.entries(turnResult.extractedContext).filter(([_, value]) => value != null)
    ) as Partial<UserContext>;

    if (Object.keys(extractedContext).length > 0) {
      updateUserContext(sessionId, extractedContext);
    }

    // Transition state if AI indicates readiness
    if (turnResult.shouldTransition) {
      updateSessionState(sessionId, 'suggesting');
    }

    return {
      success: true,
      aiMessage: turnResult.aiMessage,
      timestamp: new Date(),
      shouldTransition: turnResult.shouldTransition,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});
```

For `conversation:get-suggestions` handler:
```typescript
ipcMain.handle('conversation:get-suggestions', async (event, sessionId: string) => {
  // ... validation ...
  
  try {
    // Option A: Mock the entire transitionToSuggesting function
    // Option B: Mock just the ranking step
    
    // Choosing Option B for minimal changes:
    const session = getSession(sessionId);
    const contextualMessage = getSessionTransitionMessage(sessionId);
    
    if (contextualMessage) {
      clearSessionTransitionMessage(sessionId);
    }
    
    // Verify required context
    if (!session.userContext.energyLevel || !session.userContext.availableTime) {
      throw new Error('Missing required context');
    }
    
    updateSessionState(sessionId, 'suggesting');
    
    // E2E detection: Use mock or real ranker
    const result = isE2ETest()
      ? await mockGetRankedSuggestions(sessionId)
      : await getRankedSuggestions(sessionId);
    
    console.log('Suggestion handler using:', isE2ETest() ? 'MOCK' : 'REAL');
    
    const recipeIds = result.suggestions.map(s => s.recipeId);
    updateSessionSuggestedRecipes(sessionId, recipeIds);
    
    const aiMessage = contextualMessage || "Great! Based on your context, here are some recipes I think you'll love:";
    
    return {
      success: true,
      suggestions: result.suggestions,
      aiMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
```

**Evidence:** Current implementation at `src/main/ipc/conversation-handlers.ts:45-160`  
**Evidence:** Reference pattern at `src/main/ipc/recipe-ai-handlers.ts:36-42`

**Done When:**
- `isE2ETest()` checks are added to all 3 handlers (sendMessage, get-suggestions, refine)
- Mock functions are called when in E2E mode
- Real functions are called in production mode
- Debug logging confirms which path is taken
- All existing logic (state management, validation) remains unchanged

---

### PLAN-005: Ensure Test Database Has Required Recipes

**Action ID:** PLAN-005  
**Change Type:** verify/modify  
**File(s):** `src/main/database/seed.ts` (if changes needed)

**Instruction:**

1. Verify that the test database seed includes recipes matching the mock suggestions
2. Check that recipe IDs used in `recipe-ranker.mock.ts` exist in seed data
3. If needed, add specific test recipes with predictable IDs:
   ```typescript
   // In seed.ts or test-specific seed file
   const E2E_TEST_RECIPES = [
     {
       id: 'test-recipe-stir-fry-001',
       title: 'Quick Vegetable Stir-Fry',
       cookingTimeMinutes: 20,
       prepTimeMinutes: 10,
       cookwareType: 'one-pot',
       // ... full recipe details
     },
     // ... more recipes
   ];
   ```

4. Alternative approach: Use dynamic recipe lookup in mock ranker
   - Query actual database for recipes matching criteria
   - Return those recipe IDs in suggestions
   - This ensures recipes always exist

**Evidence:** Current seed at `src/main/database/seed.ts`  
**Evidence:** Database setup in E2E tests (check how other tests seed data)

**Done When:**
- All recipe IDs referenced in mock suggestions exist in E2E test database
- OR mock ranker dynamically queries database for real recipe IDs
- E2E tests can successfully fetch recipes by the suggested IDs

---

### PLAN-006: Update Conversation E2E Tests (If Needed)

**Action ID:** PLAN-006  
**Change Type:** modify (conditional)  
**File(s):** `e2e/conversation-suggestions.spec.ts`

**Instruction:**

1. Review test assertions to ensure they match mock responses
2. Update text matchers if needed to align with deterministic mock messages:
   
   Current (line 30):
   ```typescript
   await expect(window.locator('text=/time do you have/i')).toBeVisible({ timeout: 10000 });
   ```
   
   Mock returns: "I hear you! How much time do you have? 30 minutes? 45?"
   → Assertion should pass (contains "time do you have")

3. Update selector for Test 2 to be more specific:
   
   Current (line 86-87):
   ```typescript
   const aiMessages = window.locator('.bg-gray-200');
   await expect(aiMessages).toHaveCount(1);
   ```
   
   Problem: `.bg-gray-200` matches loading indicator + buttons + AI messages
   
   Better selector:
   ```typescript
   const aiMessages = window.locator('[data-testid="ai-message"]');
   // OR
   const aiMessages = window.locator('.bg-gray-200').filter({ hasText: /Hi!|I hear/ });
   ```
   
   **However:** This requires adding data-testid to ConversationPage.tsx first

4. If test expectations perfectly match mock responses, no changes needed

**Evidence:** Current tests at `e2e/conversation-suggestions.spec.ts:5-90`  
**Evidence:** Mock responses defined in PLAN-001

**Done When:**
- All text assertions match mock response messages
- Element selectors are specific enough to avoid false matches
- Tests pass reliably with mock implementation

---

### PLAN-007: Add data-testid to Conversation UI (Optional but Recommended)

**Action ID:** PLAN-007  
**Change Type:** modify  
**File(s):** `src/renderer/pages/ConversationPage.tsx`

**Instruction:**

1. Add `data-testid` attributes to key UI elements for more reliable test selectors
2. This is optional but highly recommended to fix Test 2's selector issue

**Changes needed:**

At line 323-331 (AI message bubbles):
```typescript
<div
  className={`max-w-[70%] px-4 py-2 rounded-lg ${
    msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'
  }`}
  data-testid={msg.role === 'user' ? 'user-message' : 'ai-message'}  // ← Add this
>
  <p>{msg.content}</p>
</div>
```

At line 373-379 (loading indicator):
```typescript
{state.isLoading && (
  <div className="flex justify-start">
    <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg" data-testid="ai-loading">  {/* ← Add this */}
      <p className="italic">AI is thinking...</p>
    </div>
  </div>
)}
```

At line 354-367 (recipe suggestion cards):
```typescript
<RecipeSuggestionCard
  key={suggestionIdx}
  data-testid="recipe-suggestion-card"  // ← Already exists per test expectations
  recipe={recipe}
  // ...
/>
```

**Evidence:** Current implementation at `src/renderer/pages/ConversationPage.tsx:320-380`  
**Evidence:** Test expects `[data-testid="recipe-suggestion-card"]` at line 41

**Done When:**
- AI messages have `data-testid="ai-message"`
- User messages have `data-testid="user-message"`
- Loading indicator has `data-testid="ai-loading"`
- Recipe cards have `data-testid="recipe-suggestion-card"` (already exists)
- Tests can use these selectors instead of CSS classes

---

### PLAN-008: Add Test Signals Documentation

**Action ID:** PLAN-008  
**Change Type:** create  
**File(s):** `src/main/conversation/conversation-service.mock.ts` (extend from PLAN-001)

**Instruction:**

1. Add comprehensive JSDoc comment at the top of the mock file
2. Document all supported test signals for error scenarios
3. Follow pattern from `src/main/ipc/recipe-ai-handlers.mock.ts:1-27`

**Documentation to add:**

```typescript
/**
 * @module conversation-service.mock
 * Mock implementation of conversation service for E2E testing.
 * Provides deterministic conversation flows without calling OpenAI API.
 * Supports test signals for error scenarios.
 *
 * Test Signal Usage:
 * - Send message 'MOCK_API_ERROR' to simulate OpenAI API failure
 * - Send message 'MOCK_INVALID_SESSION' to simulate session not found error
 * - Set userContext.mock_error = 'NO_RECIPES' to simulate no recipes found during ranking
 * - Normal inputs produce deterministic conversation flows matching test expectations
 *
 * Example Conversation Flows:
 * ```typescript
 * // Success case
 * await mockProcessConversationTurn(sessionId, "I'm feeling tired tonight");
 * // → Returns: { aiMessage: "I hear you! How much time...", shouldTransition: false }
 *
 * await mockProcessConversationTurn(sessionId, "About 30 minutes");
 * // → Returns: { aiMessage: "Perfect! With low energy...", shouldTransition: true }
 *
 * // Error case
 * await mockProcessConversationTurn(sessionId, "MOCK_API_ERROR");
 * // → Throws: Error('OpenAI API unavailable')
 * ```
 */
```

**Evidence:** Reference documentation at `src/main/ipc/recipe-ai-handlers.mock.ts:1-27`

**Done When:**
- Mock file has comprehensive module-level JSDoc
- All test signals are documented with examples
- Usage examples show deterministic conversation flows

---

### PLAN-009: Verification Testing

**Action ID:** PLAN-009  
**Change Type:** verify  
**File(s):** (test execution only)

**Instruction:**

After implementing PLAN-001 through PLAN-008, perform the following verification:

1. Run conversation E2E tests to verify they pass:
   ```bash
   npx playwright test e2e/conversation-suggestions.spec.ts
   ```
   
   Expected result:
   ```
   ✅ should display recipe suggestions after conversation
   ✅ should continue conversation if AI needs more info
   ```

2. Run full E2E suite to ensure no regressions:
   ```bash
   npx playwright test
   ```
   
   Expected result: 28/28 tests pass (previously 26/28)

3. Verify mock detection is working:
   - Check console output for "Conversation handler using: MOCK"
   - Confirm no OpenAI API calls are made during E2E tests
   - Confirm tests complete quickly (< 2s per test)

4. Test error scenarios using test signals:
   - Modify one test to send "MOCK_API_ERROR"
   - Verify error handling works correctly
   - Restore test to original state

5. Verify production code is unaffected:
   - Set environment to production mode
   - Start the app manually
   - Navigate to conversation page
   - Verify it still uses REAL OpenAI API
   - Check console for "Conversation handler using: REAL"

**Done When:**
- Both conversation E2E tests pass
- Full E2E suite passes (28/28)
- Console logs confirm mock is used in E2E mode
- Console logs confirm real API is used in production mode
- Test signals work as documented
- No regressions in other tests

---

## Acceptance Criteria

1. ✅ Both conversation E2E tests pass reliably without OpenAI API
2. ✅ Full E2E test suite passes (28/28 tests)
3. ✅ Mock implementation follows established pattern from recipe-ai-handlers
4. ✅ Test signals for error scenarios are supported and documented
5. ✅ Production code continues to use real OpenAI API (no behavioral changes)
6. ✅ Console logs confirm mock vs real path selection
7. ✅ Tests complete quickly (< 5s for both conversation tests combined)
8. ✅ Type compatibility maintained (mock returns same types as real implementation)
9. ✅ Session state properly managed in mock (messages, context, transitions)
10. ✅ All code follows TypeScript strict mode and existing code style

## Implementor Checklist

- [ ] PLAN-001: Create mock conversation service
- [ ] PLAN-002: Create mock recipe ranker
- [ ] PLAN-003: Create mock refinement function
- [ ] PLAN-004: Add E2E detection to IPC handlers
- [ ] PLAN-005: Ensure test database has required recipes
- [ ] PLAN-006: Update conversation E2E tests (if needed)
- [ ] PLAN-007: Add data-testid to conversation UI (optional)
- [ ] PLAN-008: Add test signals documentation
- [ ] PLAN-009: Verification testing

## Notes

### Design Decisions

**Decision 1: Mock at service layer, not IPC layer**
- Rationale: Keeps IPC handlers minimal, follows recipe-ai-handlers pattern
- Alternative considered: Mock entire IPC response (rejected: too brittle, loses session state management)

**Decision 2: Pattern matching for conversation flows**
- Rationale: Simple, deterministic, easy to debug
- Alternative considered: State machine with explicit states (rejected: over-engineered for E2E mocking)

**Decision 3: Use pre-defined recipe IDs**
- Rationale: Deterministic, fast, no database queries in mock
- Alternative considered: Dynamic database queries (accepted as optional fallback in PLAN-005)

**Decision 4: Maintain session state in mocks**
- Rationale: Tests verify full integration including session management
- Alternative considered: Skip session updates (rejected: tests wouldn't validate real behavior)

### Potential Issues

**Issue 1: Recipe IDs in mock may not exist in E2E database**
- Mitigation: PLAN-005 verifies and seeds required recipes
- Fallback: Use dynamic queries to find real recipes

**Issue 2: Test assertions may not match mock responses exactly**
- Mitigation: PLAN-006 reviews and updates test assertions
- Mitigation: Mock responses designed to match current test expectations

**Issue 3: `.bg-gray-200` selector matches multiple elements**
- Mitigation: PLAN-007 adds data-testid attributes
- Mitigation: PLAN-006 updates selectors to be more specific

### Implementation Phases

**Phase 1 (Core Mocking):**
- PLAN-001, PLAN-002, PLAN-003, PLAN-004
- Gets basic mocking working

**Phase 2 (Test Compatibility):**
- PLAN-005, PLAN-006
- Ensures tests can actually pass

**Phase 3 (Polish):**
- PLAN-007, PLAN-008
- Improves maintainability

**Phase 4 (Validation):**
- PLAN-009
- Confirms everything works

### Estimated Complexity

- **PLAN-001:** Medium (100-150 lines, pattern matching logic)
- **PLAN-002:** Small (50-80 lines, simple data structure)
- **PLAN-003:** Small (30-50 lines, extends PLAN-001)
- **PLAN-004:** Medium (50-80 lines, 3 handlers to modify)
- **PLAN-005:** Small (verification task, possibly 0 changes)
- **PLAN-006:** Small (0-20 lines, may not need changes)
- **PLAN-007:** Small (5-10 lines, add attributes)
- **PLAN-008:** Small (20-30 lines, documentation)
- **PLAN-009:** Small (testing/verification only)

**Total estimated LOC:** 250-400 lines (mostly new mock files)

---

## Related Files

**Must read before implementing:**
- `src/main/ipc/recipe-ai-handlers.ts` (reference pattern)
- `src/main/ipc/recipe-ai-handlers.mock.ts` (reference implementation)
- `src/main/conversation/conversation-service.ts` (interface to mock)
- `src/main/conversation/ranking-schema.ts` (return type)
- `src/main/conversation/conversation-schema.ts` (return type)
- `e2e/conversation-suggestions.spec.ts` (test expectations)

**May need to reference:**
- `src/main/utils/test-env.ts` (isE2ETest utility)
- `src/main/conversation/session-manager.ts` (state management)
- `src/main/database/seed.ts` (recipe data)
- `src/renderer/pages/ConversationPage.tsx` (UI elements)
