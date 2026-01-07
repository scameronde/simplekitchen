---
date: 2026-01-07
status: in-progress
current-task: PLAN-006
priority: critical
type: bugfix
---

# State: Fix Conversation Transition Gap

**Plan**: `thoughts/shared/plans/2026-01-07-Fix-Conversation-Transition-Gap.md`

**Current Task**: PLAN-006

**Completed Tasks**: PLAN-001, PLAN-002, PLAN-003, PLAN-004, PLAN-005

---

## Task Checklist

- [x] PLAN-001: Update IPC handler to return shouldTransition
- [x] PLAN-002: Update TypeScript type definition for sendMessage
- [x] PLAN-003: Update ConversationPage to handle transition
- [x] PLAN-004: Add unit test for shouldTransition return
- [x] PLAN-005: Add component test for transition handling
- [ ] PLAN-006: Add integration test for full flow
- [ ] PLAN-007: Add E2E test for user-visible behavior

---

## Quick Verification

After completing all tasks, verify with:

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

# Manual verification (CRITICAL!)
npm run dev
# 1. Navigate to "What's for dinner?" page
# 2. Have a conversation: "I'm tired" → "30 minutes"
# 3. Verify recipe suggestions appear automatically
# 4. Verify NO manual button click needed
# 5. Try rejecting a recipe and verify refinement works
```

---

## Acceptance Criteria Verification

### Functional Criteria

- [ ] User can have a conversation with the AI to gather context
- [ ] When AI has sufficient context (energyLevel + availableTime), suggestions appear automatically
- [ ] Recipe suggestion cards display immediately after AI signals readiness
- [ ] User does NOT need to manually trigger suggestion fetching
- [ ] If suggestion fetch fails, user sees a clear error message
- [ ] Conversation can continue normally if AI doesn't have enough context yet

### Technical Criteria

- [x] `shouldTransition` flag returned from `conversation:sendMessage` IPC handler
- [x] TypeScript type definitions updated for `sendMessage` return type
- [x] `ConversationPage.tsx` checks `shouldTransition` and calls `getSuggestions()`
- [x] Loading state displayed while fetching suggestions
- [x] Error handling for failed suggestion fetch
- [ ] No race conditions when user sends messages rapidly

### Testing Criteria

- [x] Unit test verifies `shouldTransition: true` returned when AI signals transition
- [x] Unit test verifies `shouldTransition: false` returned when AI doesn't signal transition
- [x] Component test verifies `getSuggestions()` called when transition detected
- [x] Component test verifies NO fetch when `shouldTransition` is false
- [x] Component test verifies error handling for failed suggestion fetch
- [ ] Integration test verifies full backend flow (conversation → transition → state change)
- [ ] E2E test verifies user sees recipe cards after conversation
- [ ] All existing tests still pass (no regressions)

---

## Notes

- Plan created: 2026-01-07
- Total tasks: 7
- Estimated duration: 2-4 hours
- Impact: CRITICAL - Feature completely broken without this fix
- Prerequisites: Phase 3 and Phase 4 complete ✅

---

## Implementation Notes

### PLAN-001 (Completed 2026-01-07)
- Added `shouldTransition: turnResult.shouldTransition` to IPC handler return object (line 77)
- TypeScript compilation: PASSED
- No adjacent edits needed
- File: src/main/ipc/conversation-handlers.ts

### PLAN-002 (Completed 2026-01-07)
- Added `shouldTransition?: boolean` to sendMessage return type (line 17)
- TypeScript compilation: PASSED
- Type definition now matches IPC handler implementation
- File: src/shared/types/electron.d.ts

### PLAN-003 (Completed 2026-01-07)
- Added transition detection logic to handleSend function (lines 214-246)
- TypeScript compilation: PASSED
- Adaptation: Used `suggestionsResult.suggestions` instead of double-nested version (matches SuggestionResult type definition)
- Includes loading state management and error handling
- File: src/renderer/pages/ConversationPage.tsx

### PLAN-004 (Completed 2026-01-07)
- Added `shouldTransition?: boolean` to ConversationMessageResult type (line 36)
- Added assertion `expect(result.shouldTransition).toBe(false)` to first test (line 138)
- Added assertion `expect(result.shouldTransition).toBe(true)` to transition test (line 187)
- All tests passed: 10/10 tests passing
- File: src/main/ipc/conversation-handlers.test.ts

### PLAN-005 (Completed 2026-01-07)
- Created new component test file with 3 comprehensive test cases
- Added scrollIntoView mock to fix JSDOM compatibility (line 73-74)
- Test 1: Verifies getSuggestions called when shouldTransition: true
- Test 2: Verifies NO fetch when shouldTransition: false
- Test 3: Verifies error handling for failed getSuggestions
- All tests passed: 3/3 tests passing
- File: src/renderer/pages/ConversationPage.test.tsx

---

## Blockers / Issues

(Implementor: Document any blockers or deviations from plan)

- None

---

**Last Updated**: 2026-01-07

