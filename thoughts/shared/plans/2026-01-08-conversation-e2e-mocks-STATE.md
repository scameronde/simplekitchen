# State: Conversation E2E Mocks Implementation

**Plan**: thoughts/shared/plans/2026-01-08-conversation-e2e-mocks.md  
**Current Task**: PLAN-006  
**Completed Tasks**: PLAN-001, PLAN-002, PLAN-003, PLAN-004, PLAN-005

## Quick Verification

After implementation, run these commands to verify success:

```bash
# Verify E2E tests pass
npx playwright test e2e/conversation-suggestions.spec.ts

# Expected output:
#   ✅ should display recipe suggestions after conversation
#   ✅ should continue conversation if AI needs more info

# Verify full suite passes
npx playwright test --reporter=list | grep -E "^\s+✓|✘"

# Expected: 28/28 tests pass (currently 26/28)

# Verify mock is used in E2E mode
npx playwright test e2e/conversation-suggestions.spec.ts 2>&1 | grep "Conversation handler using"

# Expected output:
#   Conversation handler using: MOCK

# Verify real API is used in production (manual test)
npm run dev
# → Navigate to "What's for dinner?" page
# → Check console for "Conversation handler using: REAL"
```

## Files to Create

- [x] `src/main/conversation/conversation-service.mock.ts` (~119 lines) - PLAN-001
- [x] `src/main/conversation/recipe-ranker.mock.ts` (~197 lines) - PLAN-002

## Files to Modify

- [x] `src/main/conversation/conversation-service.mock.ts` (add refinement function) - PLAN-003
- [x] `src/main/ipc/conversation-handlers.ts` (add E2E detection) - PLAN-004
- [x] `src/main/main.ts` (add E2E database seeding) - PLAN-005
- [ ] `e2e/conversation-suggestions.spec.ts` (possibly, if assertions don't match)
- [ ] `src/renderer/pages/ConversationPage.tsx` (optional, add data-testids)

## Notes

- Plan created: 2026-01-08
- Total tasks: 9 (PLAN-001 through PLAN-009)
- Phases: 4 (Core Mocking → Test Compatibility → Polish → Validation)
- Estimated LOC: 250-400 lines (mostly new mock files)
- Pattern reference: `src/main/ipc/recipe-ai-handlers.mock.ts` (420 lines)
- Research document: `thoughts/shared/research/2026-01-08-conversation-test-failures.md`

## Progress Log

- **2026-01-08**: PLAN-001 complete - Created mock conversation service with pattern matching and test signals
- **2026-01-08**: PLAN-002 complete - Created mock recipe ranker with dynamic database queries
- **2026-01-08**: PLAN-003 complete - Added mock refinement function with 3-cycle limit and escalation
- **2026-01-08**: PLAN-004 complete - Added E2E detection to all 3 conversation IPC handlers with debug logging
- **2026-01-08**: PLAN-005 complete - Added automatic database seeding (10 recipes) for E2E test mode
