# State: Conversation E2E Mocks Implementation

**Plan**: thoughts/shared/plans/2026-01-08-conversation-e2e-mocks.md  
**Current Task**: Not started  
**Completed Tasks**: (none yet)

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

- [ ] `src/main/conversation/conversation-service.mock.ts` (~100-150 lines)
- [ ] `src/main/conversation/recipe-ranker.mock.ts` (~50-80 lines)

## Files to Modify

- [ ] `src/main/ipc/conversation-handlers.ts` (add E2E detection)
- [ ] `src/main/database/seed.ts` (possibly, if recipe IDs don't exist)
- [ ] `e2e/conversation-suggestions.spec.ts` (possibly, if assertions don't match)
- [ ] `src/renderer/pages/ConversationPage.tsx` (optional, add data-testids)

## Notes

- Plan created: 2026-01-08
- Total tasks: 9 (PLAN-001 through PLAN-009)
- Phases: 4 (Core Mocking → Test Compatibility → Polish → Validation)
- Estimated LOC: 250-400 lines (mostly new mock files)
- Pattern reference: `src/main/ipc/recipe-ai-handlers.mock.ts` (420 lines)
- Research document: `thoughts/shared/research/2026-01-08-conversation-test-failures.md`
