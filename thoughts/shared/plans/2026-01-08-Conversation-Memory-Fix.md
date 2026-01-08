# Conversation Memory Loss - Implementation Plan

## Inputs
- **Research report**: `thoughts/shared/research/2026-01-08-Conversation-Memory-Loss-Root-Cause.md`
- **User request**: Fix conversation memory loss in AI conversation feature
- **Critical defect**: OpenAI API receives conversation history as formatted string instead of native message array

## Verified Current State

### Fact 1: Message Storage Works Correctly
- **Evidence**: `src/main/conversation/session-manager.ts:58-66`
- **Excerpt**:
```typescript
export function updateSessionMessages(sessionId: string, message: ConversationMessage): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  
  session.messages.push(message);
  session.turnCount += 1;
  session.turnsInCurrentState += 1;
  session.lastActivity = new Date();
}
```
- **Conclusion**: Session storage is not the problem; all messages are stored correctly in `session.messages[]`

### Fact 2: OpenAI Receives String Prompt, Not Message Array
- **Evidence**: `src/main/conversation/conversation-service.ts:86-95`
- **Excerpt**:
```typescript
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: GATHERING_SYSTEM_PROMPT },
    { role: 'user', content: prompt },  // ← Entire conversation as STRING
  ],
  response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
  temperature: 0.7,
  max_tokens: 500,
});
```
- **Conclusion**: This is the root cause - OpenAI sees only 2 messages (system + text summary), not the full conversation thread

### Fact 3: Prompt Builder Creates Text Summary
- **Evidence**: `src/main/conversation/prompts.ts:150-166`
- **Excerpt**:
```typescript
export function buildConversationPrompt(
  session: ConversationSession,
  dietaryProfile: DietaryProfile
): string {
  const recentMessages = session.messages.slice(-5);  // Only last 5!
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
- **Conclusion**: Function returns string with conversation formatted as text, not structured messages

### Fact 4: ConversationMessage Type Structure
- **Evidence**: `src/shared/types/conversation.ts:75-81`
- **Excerpt**:
```typescript
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedRecipes?: string[];
  suggestions?: RecipeSuggestion[];
}
```
- **Conclusion**: Message structure already matches OpenAI's expected format (role + content)

### Fact 5: Recipe Ranker Has Same Architecture
- **Evidence**: `src/main/conversation/recipe-ranker.ts:95-104`
- **Excerpt**:
```typescript
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: RANKING_SYSTEM_PROMPT },
    { role: 'user', content: prompt },  // Also uses string prompt
  ],
  response_format: zodResponseFormat(RecipeSuggestionSchema, 'recipe_suggestions'),
  temperature: 0.3,
  max_tokens: 1000,
});
```
- **Conclusion**: Recipe ranker doesn't need conversation history (it's single-turn ranking), so this is acceptable

### Fact 6: Tests Verify Message Storage
- **Evidence**: `src/main/conversation/conversation-service.test.ts:118-129`
- **Excerpt**:
```typescript
// Expect updateSessionMessages called twice (user + AI)
expect(mockUpdateSessionMessages).toHaveBeenCalledTimes(2);
expect(mockUpdateSessionMessages).toHaveBeenNthCalledWith(1, sessionId, {
  role: 'user',
  content: "I'm pretty tired",
  timestamp: expect.any(Date),
});
expect(mockUpdateSessionMessages).toHaveBeenNthCalledWith(2, sessionId, {
  role: 'assistant',
  content: 'Got it! How much time do you have?',
  timestamp: expect.any(Date),
});
```
- **Conclusion**: Tests confirm messages are added correctly; they do NOT verify OpenAI receives proper format

## Goals / Non-Goals

### Goals
1. Fix OpenAI API call to send conversation history as proper message array
2. Maintain structured output parsing with `response_format: zodResponseFormat(...)`
3. Include dietary restrictions and user context in the conversation flow
4. Preserve all existing tests and functionality
5. Support longer conversations (more than 5 messages)

### Non-Goals
1. Persist conversation history to database (sessions remain in-memory)
2. Change recipe ranker implementation (single-turn is correct for ranking)
3. Modify session manager or storage layer (already working correctly)
4. Change IPC handlers or frontend code (no interface changes)

## Design Overview

### Current Flow (Broken)
```
User Message → Session Storage → Build String Prompt → OpenAI (2 messages: system + prompt string) → Extract Response → Session Storage
```

### Target Flow (Fixed)
```
User Message → Session Storage → Build Message Array → OpenAI (N messages: system + history + context) → Extract Response → Session Storage
```

### Key Changes
1. **Replace `buildConversationPrompt()`** with `buildConversationMessages()` that returns message array
2. **Embed dietary restrictions and context** as a system message or context message (not in user messages)
3. **Send full conversation history** to OpenAI as structured message array
4. **Keep system prompt** separate and prepended to message array

### Data Flow
```
session.messages (ConversationMessage[])
  ↓
buildConversationMessages(session, dietaryProfile)
  ↓
[
  { role: 'system', content: GATHERING_SYSTEM_PROMPT + context },
  { role: 'user', content: 'I want chicken' },
  { role: 'assistant', content: 'Great! How much time...' },
  { role: 'user', content: 'I have lots of time' },
  ...
]
  ↓
OpenAI API
```

## Implementation Instructions

### PLAN-001: Create New Message Builder Function
- **Action ID**: PLAN-001
- **Change Type**: modify
- **File**: `src/main/conversation/prompts.ts`
- **Instruction**:
  1. Keep existing `buildConversationPrompt()` function temporarily (for reference and comparison)
  2. Create new function `buildConversationMessages()` with signature:
     ```typescript
     export function buildConversationMessages(
       session: ConversationSession,
       dietaryProfile: DietaryProfile
     ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
     ```
  3. Implementation details:
     - Create enhanced system message by appending dietary context to `GATHERING_SYSTEM_PROMPT`:
       ```typescript
       const restrictions = dietaryProfile.hardRestrictions.join(', ') || 'None';
       const contextSummary = JSON.stringify(session.userContext, null, 2);
       const enhancedSystemPrompt = `${GATHERING_SYSTEM_PROMPT}\n\n# Current User Context\n${contextSummary}\n\n# Dietary Restrictions\n${restrictions}`;
       ```
     - Start message array with system message: `[{ role: 'system', content: enhancedSystemPrompt }]`
     - Map `session.messages` to OpenAI format, converting 'assistant' role correctly:
       ```typescript
       const conversationMessages = session.messages.map(msg => ({
         role: msg.role,
         content: msg.content
       }));
       ```
     - Return concatenated array: `[systemMessage, ...conversationMessages]`
     - Do NOT limit to last 5 messages - include full conversation history
  4. Add JSDoc comment explaining the function returns OpenAI-compatible message array format
- **Evidence**: `src/main/conversation/prompts.ts:150-166` (old implementation to replace)
- **Done When**: 
  - Function compiles without TypeScript errors
  - Function returns array with system message first, then all conversation messages
  - Type signature matches OpenAI's expected format

### PLAN-002: Update Conversation Service to Use Message Array
- **Action ID**: PLAN-002
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.ts`
- **Instruction**:
  1. Import the new function: `import { GATHERING_SYSTEM_PROMPT, buildConversationMessages } from './prompts.js';`
  2. Locate the OpenAI API call at lines 84-95
  3. Replace lines 82-95 with:
     ```typescript
     // Step 4: Build message array with conversation history
     const messages = buildConversationMessages(session, dietaryProfile);

     // Step 5: Call OpenAI API with full conversation history
     const client = getOpenAIClient();
     const completion = await client.chat.completions.parse({
       model: 'gpt-4o-mini',
       messages: messages,  // ← Now an array of messages, not [system, user]
       response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
       temperature: 0.7,
       max_tokens: 500,
     });
     ```
  4. Update inline comment at Step 4 to reflect new behavior
  5. No other changes needed - the rest of the function flow remains identical
- **Evidence**: `src/main/conversation/conversation-service.ts:86-95` (defect location)
- **Done When**:
  - Code compiles without errors
  - OpenAI API receives message array instead of 2-message format
  - All downstream code (response parsing, session updates) continues to work

### PLAN-003: Update Tests to Verify Message Array Format
- **Action ID**: PLAN-003
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.test.ts`
- **Instruction**:
  1. Locate test "should extract energy level from user response" (lines 69-130)
  2. After the existing assertions (line 129), add verification that OpenAI was called with message array:
     ```typescript
     // Verify OpenAI received message array (not string prompt)
     expect(mockParse).toHaveBeenCalledTimes(1);
     const openAICallArgs = mockParse.mock.calls[0][0];
     expect(openAICallArgs.messages).toBeInstanceOf(Array);
     expect(openAICallArgs.messages.length).toBeGreaterThan(1); // System + at least 1 user message
     expect(openAICallArgs.messages[0].role).toBe('system');
     expect(openAICallArgs.messages[1].role).toBe('user');
     ```
  3. Locate test "should transition to suggesting when context complete" (lines 132-194)
  4. After line 193, add similar verification for multi-turn conversation:
     ```typescript
     // Verify OpenAI received full conversation history
     const openAICallArgs = mockParse.mock.calls[0][0];
     expect(openAICallArgs.messages.length).toBeGreaterThan(2); // System + previous messages + new message
     ```
  5. Add new test case to explicitly verify conversation memory:
     ```typescript
     it('should send full conversation history to OpenAI', async () => {
       // Mock session with 3 previous turns
       const mockSession: ConversationSession = {
         sessionId,
         messages: [
           { role: 'user', content: 'I want chicken', timestamp: new Date() },
           { role: 'assistant', content: 'How much time?', timestamp: new Date() },
           { role: 'user', content: 'I have 30 minutes', timestamp: new Date() },
         ],
         userContext: { energyLevel: 'low', availableTime: 30 },
         suggestedRecipes: [],
         rejectedRecipes: [],
         state: 'gathering',
         turnCount: 3,
         refinementCount: 0,
         turnsInCurrentState: 3,
         createdAt: new Date(),
         lastActivity: new Date(),
       };
       mockGetSession.mockReturnValue(mockSession);
       mockGetDietaryProfile.mockResolvedValue({
         id: 1,
         hardRestrictions: [],
         preferences: [],
         explicitInclusions: [],
         explicitExclusions: [],
         updatedAt: new Date(),
       });
       mockParse.mockResolvedValue({
         choices: [{ message: { parsed: {
           aiMessage: 'Got it!',
           extractedContext: {},
           shouldTransition: true,
         }}}],
       });

       await processConversationTurn(sessionId, 'Any suggestions?');

       // Verify OpenAI received all 3 previous messages + new message
       const openAICallArgs = mockParse.mock.calls[0][0];
       expect(openAICallArgs.messages.length).toBe(5); // system + 3 previous + 1 new
       expect(openAICallArgs.messages[0].role).toBe('system');
       expect(openAICallArgs.messages[1].role).toBe('user');
       expect(openAICallArgs.messages[1].content).toBe('I want chicken');
       expect(openAICallArgs.messages[2].role).toBe('assistant');
       expect(openAICallArgs.messages[2].content).toBe('How much time?');
       expect(openAICallArgs.messages[3].role).toBe('user');
       expect(openAICallArgs.messages[3].content).toBe('I have 30 minutes');
       expect(openAICallArgs.messages[4].role).toBe('user');
       expect(openAICallArgs.messages[4].content).toBe('Any suggestions?');
     });
     ```
- **Evidence**: `src/main/conversation/conversation-service.test.ts:69-194` (existing tests to enhance)
- **Done When**:
  - All existing tests pass with new implementation
  - New test explicitly verifies full conversation history is sent to OpenAI
  - Tests verify message array format (not string prompt)

### PLAN-004: Add Unit Tests for buildConversationMessages
- **Action ID**: PLAN-004
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.test.ts`
- **Instruction**:
  1. Locate `describe('buildConversationPrompt', ...)` block (lines 247-327)
  2. Add new describe block after it:
     ```typescript
     describe('buildConversationMessages', () => {
       it('should return message array with system message first', () => {
         const mockSession: ConversationSession = {
           sessionId: 'test-session',
           messages: [],
           userContext: {},
           suggestedRecipes: [],
           rejectedRecipes: [],
           state: 'gathering',
           turnCount: 0,
           refinementCount: 0,
           turnsInCurrentState: 0,
           createdAt: new Date(),
           lastActivity: new Date(),
         };
         const mockDietaryProfile: DietaryProfile = {
           id: 1,
           hardRestrictions: ['gluten-free'],
           preferences: [],
           explicitInclusions: [],
           explicitExclusions: [],
           updatedAt: new Date(),
         };

         const messages = buildConversationMessages(mockSession, mockDietaryProfile);

         expect(messages).toBeInstanceOf(Array);
         expect(messages.length).toBeGreaterThan(0);
         expect(messages[0].role).toBe('system');
         expect(messages[0].content).toContain('gluten-free');
       });

       it('should include all conversation messages in order', () => {
         const mockSession: ConversationSession = {
           sessionId: 'test-session',
           messages: [
             { role: 'user', content: 'Message 1', timestamp: new Date() },
             { role: 'assistant', content: 'Message 2', timestamp: new Date() },
             { role: 'user', content: 'Message 3', timestamp: new Date() },
           ],
           userContext: { energyLevel: 'low' },
           suggestedRecipes: [],
           rejectedRecipes: [],
           state: 'gathering',
           turnCount: 3,
           refinementCount: 0,
           turnsInCurrentState: 0,
           createdAt: new Date(),
           lastActivity: new Date(),
         };
         const mockDietaryProfile: DietaryProfile = {
           id: 1,
           hardRestrictions: [],
           preferences: [],
           explicitInclusions: [],
           explicitExclusions: [],
           updatedAt: new Date(),
         };

         const messages = buildConversationMessages(mockSession, mockDietaryProfile);

         expect(messages.length).toBe(4); // system + 3 messages
         expect(messages[0].role).toBe('system');
         expect(messages[1].role).toBe('user');
         expect(messages[1].content).toBe('Message 1');
         expect(messages[2].role).toBe('assistant');
         expect(messages[2].content).toBe('Message 2');
         expect(messages[3].role).toBe('user');
         expect(messages[3].content).toBe('Message 3');
       });

       it('should include user context in system message', () => {
         const mockSession: ConversationSession = {
           sessionId: 'test-session',
           messages: [],
           userContext: { energyLevel: 'high', availableTime: 60 },
           suggestedRecipes: [],
           rejectedRecipes: [],
           state: 'gathering',
           turnCount: 0,
           refinementCount: 0,
           turnsInCurrentState: 0,
           createdAt: new Date(),
           lastActivity: new Date(),
         };
         const mockDietaryProfile: DietaryProfile = {
           id: 1,
           hardRestrictions: [],
           preferences: [],
           explicitInclusions: [],
           explicitExclusions: [],
           updatedAt: new Date(),
         };

         const messages = buildConversationMessages(mockSession, mockDietaryProfile);

         expect(messages[0].content).toContain('high');
         expect(messages[0].content).toContain('60');
       });

       it('should not limit message history (unlike old buildConversationPrompt)', () => {
         const mockSession: ConversationSession = {
           sessionId: 'test-session',
           messages: Array.from({ length: 10 }, (_, i) => ({
             role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
             content: `Message ${i + 1}`,
             timestamp: new Date(),
           })),
           userContext: {},
           suggestedRecipes: [],
           rejectedRecipes: [],
           state: 'gathering',
           turnCount: 10,
           refinementCount: 0,
           turnsInCurrentState: 0,
           createdAt: new Date(),
           lastActivity: new Date(),
         };
         const mockDietaryProfile: DietaryProfile = {
           id: 1,
           hardRestrictions: [],
           preferences: [],
           explicitInclusions: [],
           explicitExclusions: [],
           updatedAt: new Date(),
         };

         const messages = buildConversationMessages(mockSession, mockDietaryProfile);

         // Should include system + all 10 messages
         expect(messages.length).toBe(11);
         expect(messages[1].content).toBe('Message 1');
         expect(messages[10].content).toBe('Message 10');
       });
     });
     ```
  3. Import `buildConversationMessages` at top of file alongside other imports
- **Evidence**: `src/main/conversation/conversation-service.test.ts:247-327` (existing test structure)
- **Done When**:
  - All 4 new unit tests pass
  - Tests verify message array structure, ordering, context inclusion, and no message limit

### PLAN-005: Remove or Deprecate Old buildConversationPrompt Function
- **Action ID**: PLAN-005
- **Change Type**: modify
- **File**: `src/main/conversation/prompts.ts`
- **Instruction**:
  1. Add deprecation comment above `buildConversationPrompt()` function:
     ```typescript
     /**
      * @deprecated Use buildConversationMessages() instead. This function formats
      * conversation as a text string, which breaks OpenAI's conversational context.
      * Kept temporarily for reference only. Will be removed in future version.
      * 
      * Build a prompt for the AI that includes conversation history and user context.
      * ... (rest of original JSDoc)
      */
     ```
  2. Do NOT remove the function yet (keep for safety during transition)
  3. Ensure no imports reference it except in tests (verify with grep)
  4. Add note in file header comment explaining the deprecation
- **Evidence**: `src/main/conversation/prompts.ts:150-166` (function to deprecate)
- **Done When**:
  - Function marked as deprecated with clear JSDoc
  - No production code uses the old function (only conversation-service uses new one)
  - Old tests still pass (they can continue testing the deprecated function)

### PLAN-006: Run All Tests and Verify Fix
- **Action ID**: PLAN-006
- **Change Type**: test
- **File**: N/A
- **Instruction**:
  1. Run unit tests: `npm run test:unit`
  2. Verify all conversation-related tests pass:
     - `src/main/conversation/conversation-service.test.ts`
     - `src/main/ipc/conversation-handlers.test.ts`
  3. Run integration tests: `npm run test:integration`
  4. Run E2E test: `npm run test:e2e -- e2e/conversation-suggestions.spec.ts`
  5. If any tests fail:
     - Analyze failure reason
     - Fix issue in code (not tests, unless test is incorrect)
     - Re-run tests
  6. Verify type checking: `npm run typecheck`
- **Evidence**: Project has comprehensive test suite (verified in `conversation-service.test.ts`)
- **Done When**:
  - All unit tests pass (100%)
  - All integration tests pass
  - E2E conversation test passes
  - No TypeScript errors

### PLAN-007: Manual Verification (Optional but Recommended)
- **Action ID**: PLAN-007
- **Change Type**: manual-test
- **File**: N/A
- **Instruction**:
  1. Start the application: `npm run dev`
  2. Open the conversation/decision support feature
  3. Start a new conversation session
  4. Have a multi-turn conversation (at least 5 exchanges):
     - User: "I'm tired tonight"
     - AI: (should ask about time)
     - User: "I have about 30 minutes"
     - AI: (should remember you're tired AND have 30 min)
     - User: "Maybe something with chicken?"
     - AI: (should remember all previous context)
  5. Verify AI responses reference previous conversation turns
  6. Check browser console and terminal for errors
  7. Verify suggestions provided match conversation context
- **Evidence**: N/A (manual test)
- **Done When**:
  - AI demonstrates memory of previous conversation turns
  - No console errors
  - Conversation flows naturally with context awareness

## Verification Tasks

### Assumption 1: OpenAI Structured Output Supports Message Arrays
- **Assumption**: `response_format: zodResponseFormat(...)` works with multi-message arrays
- **Verification Step**: Review OpenAI API documentation for structured outputs
- **Pass Condition**: Documentation confirms structured outputs work with conversation arrays (NOT just single user message)
- **Risk if False**: Would need alternative approach (e.g., JSON mode without zod validation)
- **Mitigation**: OpenAI's chat completions API is designed for conversations; structured outputs are an overlay feature that works with any message array

### Assumption 2: No Token Limit Issues with Full History
- **Assumption**: Including all messages won't exceed token limits for short conversations (<20 turns)
- **Verification Step**: Calculate token usage for typical 10-turn conversation
- **Pass Condition**: Total tokens (system + messages + response) < 4000 (well under gpt-4o-mini's limit)
- **Risk if False**: May need to implement message truncation logic
- **Mitigation**: Add token counting in future iteration if needed; start with full history for now

## Acceptance Criteria

1. **OpenAI receives message array**: API call passes array of messages, not 2-element array with string prompt
2. **Full conversation history included**: All `session.messages` are sent to OpenAI (no 5-message limit)
3. **System message contains context**: Dietary restrictions and user context embedded in system message
4. **All tests pass**: Unit, integration, and E2E tests pass without modification to test expectations
5. **TypeScript compiles**: No type errors introduced by changes
6. **Backward compatibility**: Session storage, IPC handlers, and frontend require no changes
7. **AI demonstrates memory**: Manual testing shows AI references previous turns in conversation

## Implementor Checklist

- [ ] PLAN-001: Create buildConversationMessages() function
- [ ] PLAN-002: Update conversation-service.ts to use message array
- [ ] PLAN-003: Update existing tests to verify message array format
- [ ] PLAN-004: Add unit tests for buildConversationMessages()
- [ ] PLAN-005: Deprecate old buildConversationPrompt() function
- [ ] PLAN-006: Run all tests and verify fix
- [ ] PLAN-007: Manual verification (optional)

## Notes

### Why This Fix Is Correct
- OpenAI's chat models are designed to process message arrays as conversation threads
- The `role: 'assistant'` messages represent the AI's own previous responses
- By sending history as structured messages, OpenAI can:
  - Maintain conversational context across turns
  - Reference its own previous responses
  - Build coherent multi-turn conversations
  - Apply conversation-level understanding (not just text summarization)

### Why This Was Broken Before
- Embedding conversation as text in a single user message treats history as "informational text"
- OpenAI doesn't recognize the "AI: ..." lines as its own previous responses
- Each API call appears independent, losing conversational state
- The 5-message limit further truncates context

### Migration Safety
- No database changes required (sessions are in-memory)
- No API contract changes (IPC handlers unchanged)
- No frontend changes (UI unchanged)
- Old function kept temporarily for rollback safety
- Comprehensive test coverage ensures correctness

### Future Enhancements (Out of Scope)
- Token counting and smart truncation for very long conversations
- Conversation summarization for context compression
- Persist conversation history to database for cross-session learning
- A/B testing to measure improvement in conversation quality
