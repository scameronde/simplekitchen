---
date: 2026-01-16
phase: 5
epic-id: 'EPIC-002'
status: pending
current-task: none
---

# State: Phase 5 - Selection & Shopping List

**Plan**: `thoughts/shared/plans/2026-01-16-Conversational-Decision-Support-Phase5-Selection-Shopping.md`

**Current Task**: None (awaiting start)

**Completed Tasks**: (none yet)

---

## Task Checklist

- [ ] PLAN-001: Create cooking-sessions.ts DAL
- [ ] PLAN-002: Create shopping-list.ts utility
- [ ] PLAN-003: Add confirmSelection to conversation-service.ts
- [ ] PLAN-004: Add IPC handler for conversation:confirm-selection
- [ ] PLAN-005: Update preload.ts with confirmSelection binding
- [ ] PLAN-006: Update electron.d.ts with confirmSelection type
- [ ] PLAN-007: Move ShoppingListItem to shared types
- [ ] PLAN-008: Implement handleSelect in ConversationPage
- [ ] PLAN-009: Create ShoppingListPage component
- [ ] PLAN-010: Add shopping list routing to App
- [ ] PLAN-011: Write unit tests for cooking-sessions DAL
- [ ] PLAN-012: Write unit tests for shopping-list utility
- [ ] PLAN-013: Write integration tests for confirmSelection
- [ ] PLAN-014: Write component tests for ShoppingListPage
- [ ] PLAN-015: Write E2E test for full decision flow

---

## Quick Verification

After completing all tasks, verify with:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run all tests
npm test

# Run specific test suites
npm test cooking-sessions.test.ts
npm test shopping-list.test.ts
npm test conversation-service.test.ts
npm test ShoppingListPage.test.tsx

# Run E2E tests
npm run test:e2e

# Manual verification (critical!)
npm run dev
# 1. Start conversation ("What's for dinner?")
# 2. Provide context (energy: medium, time: 45 minutes)
# 3. Wait for recipe suggestions to appear
# 4. Click "Select this recipe" on first suggestion
# 5. Verify shopping list page appears
# 6. Verify all ingredients displayed with quantities/units
# 7. Test checkbox interactions (click to check/uncheck)
# 8. Verify optional ingredients marked with "(optional)"
# 9. Click "Back to Conversation" button
# 10. Verify cooking session saved in database
```

---

## Acceptance Criteria Verification

### Functional Criteria

- [ ] User can click "Select this recipe" button
- [ ] Shopping list page displays with recipe name
- [ ] All ingredients shown with correct quantities/units
- [ ] Optional ingredients marked with "(optional)"
- [ ] Checkboxes work (toggle checked state)
- [ ] User can navigate back to conversation
- [ ] Cooking session saved to database
- [ ] Session state transitions to 'confirmed'
- [ ] Full flow completes in <10 minutes

### Technical Criteria

- [ ] cooking_sessions DAL functions work (create, getById, getRecent)
- [ ] Shopping list generation extracts ingredients correctly
- [ ] confirmSelection validates state and saves to DB
- [ ] IPC handler conversation:confirm-selection works securely
- [ ] ShoppingListPage renders without errors
- [ ] App routing includes 'shopping-list' view
- [ ] Shopping list generation <2 seconds
- [ ] Foreign key constraint enforced

### Testing Criteria

- [ ] Unit tests pass for cooking-sessions DAL (>85% coverage)
- [ ] Unit tests pass for shopping-list utility (>90% coverage)
- [ ] Integration tests pass for confirmSelection
- [ ] Component tests pass for ShoppingListPage (>85% coverage)
- [ ] E2E test passes for full decision flow
- [ ] All tests run successfully
- [ ] Type checking passes
- [ ] Linting passes

---

## Notes

- Plan created: 2026-01-16
- Total tasks: 15
- Estimated duration: 5-7 days (per master plan)
- Prerequisites: Phase 4 complete ✅

---

## Prerequisites Verified

- [x] Phase 0 complete (cooking_sessions table exists)
- [x] Phase 1 complete (conversation infrastructure exists)
- [x] Phase 2 complete (AI integration and context gathering)
- [x] Phase 3 complete (recipe suggestions and ranking)
- [x] Phase 4 complete (feedback and refinement)
- [x] Recipe DAL with ingredients (EPIC-001)

---

## Implementation Notes

(Implementor: Add notes here as you work through tasks)

---

## Blockers / Issues

(Implementor: Document any blockers or deviations from plan)

- None

---

**Last Updated**: 2026-01-16

**Status**: Pending (awaiting implementation start)
