# State: Conversation Memory Loss Fix

**Plan**: thoughts/shared/plans/2026-01-08-Conversation-Memory-Fix.md  
**Current Task**: PLAN-006  
**Completed Tasks**: PLAN-001, PLAN-002, PLAN-003, PLAN-004, PLAN-005

## Quick Verification

After implementation, verify the fix with:

```bash
# Run unit tests
npm run test:unit -- src/main/conversation/conversation-service.test.ts

# Run all tests
npm test

# Type check
npm run typecheck

# Manual test (optional)
npm run dev
# Then test conversation feature with multi-turn dialogue
```

## Expected Outcome

OpenAI API should receive message array like:
```json
[
  { "role": "system", "content": "You are a friendly recipe advisor...\n\n# Current User Context\n{...}\n\n# Dietary Restrictions\nNone" },
  { "role": "user", "content": "I'm tired tonight" },
  { "role": "assistant", "content": "How much time do you have?" },
  { "role": "user", "content": "About 30 minutes" }
]
```

NOT the old broken format:
```json
[
  { "role": "system", "content": "You are a friendly recipe advisor..." },
  { "role": "user", "content": "# User's Dietary Restrictions\nNone\n\n# Conversation History\nUser: I'm tired tonight\nAI: How much time do you have?\nUser: About 30 minutes" }
]
```

## Notes

- Plan created: 2026-01-08
- Total tasks: 7 (6 required, 1 optional manual test)
- Phases: Implementation (PLAN-001 to PLAN-005), Testing (PLAN-006), Manual Verification (PLAN-007)
- Critical files: `src/main/conversation/prompts.ts`, `src/main/conversation/conversation-service.ts`
- No breaking changes expected

## Progress Log

- **PLAN-001 (✅ Complete)**: Created buildConversationMessages() function in prompts.ts
  - Returns OpenAI-compatible message array format
  - Includes full conversation history (no limit)
  - Embeds dietary restrictions and user context in system message
  - TypeScript compilation verified
  - Commit: 1e6ffe0

- **PLAN-002 (✅ Complete)**: Updated conversation-service.ts to use message array
  - Replaced buildConversationPrompt() with buildConversationMessages()
  - OpenAI API now receives full message array instead of 2-message format
  - Each conversation turn preserved as separate message
  - Removed unused GATHERING_SYSTEM_PROMPT import
  - TypeScript compilation verified
  - Commit: 8a5b01d

- **PLAN-003 (✅ Complete)**: Updated tests to verify message array format
  - Added verification in "should extract energy level" test
  - Added verification in "should transition to suggesting" test
  - Added new comprehensive test "should send full conversation history to OpenAI"
  - Fixed conversation service to re-fetch session after adding user message
  - Fixed test mocks to properly update session messages array
  - All 16 tests passing
  - Commit: b631d49

- **PLAN-004 (✅ Complete)**: Added unit tests for buildConversationMessages()
  - Added import for buildConversationMessages in test file
  - Created new test suite with 4 comprehensive test cases
  - Test 1: Verifies message array structure with system message first
  - Test 2: Verifies all conversation messages included in correct order
  - Test 3: Verifies user context included in system message
  - Test 4: Verifies no message limit (all 10+ messages preserved)
  - All 20 tests passing (4 new + 16 existing)
  - TypeScript compilation verified with strict null checks
  - Commit: [pending]

- **PLAN-005 (✅ Complete)**: Deprecated old buildConversationPrompt() function
  - Added deprecation notice to file header explaining why function is deprecated
  - Added @deprecated JSDoc tag with clear migration guidance
  - Explained function "breaks OpenAI's conversational context" by formatting as text
  - Kept function temporarily for reference (not removed)
  - Verified no production code uses deprecated function (only test files)
  - All 20 tests still passing with deprecated function
  - TypeScript compilation verified (no errors)
  - Commit: [pending]
