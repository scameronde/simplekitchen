---
date: 2026-01-06
phase: 4
epic-id: 'EPIC-002'
status: ready
current-task: PLAN-001
---

# State: Phase 4 - Feedback & Iterative Refinement

**Plan**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase4-Feedback-Refinement.md`

**Current Task**: PLAN-003

**Completed Tasks**: PLAN-001, PLAN-002

---

## Task Checklist

- [x] PLAN-001: Extend ConversationSession type with refinementCount and turnsInCurrentState
- [x] PLAN-002: Add rejection tracking to session-manager
- [ ] PLAN-003: Add buildRefinementContext to prompts.ts
- [ ] PLAN-004: Extend recipe-ranker to exclude rejected recipes
- [ ] PLAN-005: Add processRefinement to conversation-service
- [ ] PLAN-006: Add IPC handlers for rejection and refinement
- [ ] PLAN-007: Extend electron.d.ts with new API methods
- [ ] PLAN-008: Update preload.ts with IPC bindings
- [ ] PLAN-009: Create FeedbackDialog component
- [ ] PLAN-010: Update ConversationPage for refinement workflow
- [ ] PLAN-011: Write unit tests for session-manager rejection tracking
- [ ] PLAN-012: Write unit tests for buildRefinementContext
- [ ] PLAN-013: Write integration tests for processRefinement
- [ ] PLAN-014: Write component tests for FeedbackDialog

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
npm test session-manager.test.ts
npm test prompts.test.ts
npm test conversation-service.test.ts
npm test FeedbackDialog.test.tsx

# Manual verification (important!)
npm run dev
# 1. Start conversation and provide context
# 2. Get suggestions from Phase 3
# 3. Click "Not this one" on a recipe
# 4. Verify feedback dialog appears with recipe name
# 5. Select "Missing ingredient" and submit
# 6. Verify new suggestions appear (without rejected recipe)
# 7. Reject 3 more recipes sequentially
# 8. Verify escalation message appears after 3rd rejection
```

---

## Acceptance Criteria Verification

### Functional Criteria

- [ ] User can click "Not this one" button on recipe card
- [ ] Feedback dialog opens with recipe name in heading
- [ ] Quick-reply buttons work (Missing ingredient, Not in the mood, Too complex, Other)
- [ ] Custom text input appears when "Other" selected
- [ ] Skip button allows rejection without reason
- [ ] Rejected recipe does NOT appear in next refinement
- [ ] After 3 refinements, escalation message appears (no more suggestions)
- [ ] Escalation message offers concrete next steps

### Technical Criteria

- [ ] rejectedRecipes array populated in session state
- [ ] refinementCount increments on each rejection
- [ ] turnsInCurrentState resets on state transitions
- [ ] recipe-ranker excludes rejected recipes from candidates
- [ ] buildRefinementContext injects rejection patterns into prompt
- [ ] processRefinement enforces max 3 cycle limit
- [ ] conversation:reject-recipe IPC handler works
- [ ] conversation:refine IPC handler returns new suggestions
- [ ] State transitions: suggesting → refining

### Testing Criteria

- [ ] All unit tests pass (session-manager, prompts)
- [ ] All integration tests pass (conversation-service)
- [ ] All component tests pass (FeedbackDialog)
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Test coverage >85% for new code

---

## Notes

- Plan created: 2026-01-06
- Total tasks: 14
- Estimated duration: 7-10 days (per master plan)
- Prerequisites: Phase 3 complete ✅

---

## Implementation Notes

### PLAN-001 (Complete)

- Added `refinementCount` and `turnsInCurrentState` fields to ConversationSession interface
- Note: This temporarily breaks type checking in session-manager.ts and test files
- PLAN-002 will fix these errors by initializing the new fields

### PLAN-002 (Complete)

- Added `addRejectedRecipe()` function to session-manager.ts
- Initialized `refinementCount: 0` and `turnsInCurrentState: 0` in createSession()
- Updated updateSessionMessages() to increment turnsInCurrentState
- Updated updateSessionState() to reset turnsInCurrentState on state transitions
- Fixed all test files: conversation-service.test.ts, recipe-ranker.test.ts, conversation-handlers.test.ts
- All type errors resolved - typecheck and lint pass ✅

---

## Blockers / Issues

(Implementor: Document any blockers or deviations from plan)

- None

---

**Last Updated**: 2026-01-06
