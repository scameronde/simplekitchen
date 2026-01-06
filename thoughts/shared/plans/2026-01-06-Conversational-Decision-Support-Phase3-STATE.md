---
date: 2026-01-06
phase: 3
epic-id: 'EPIC-002'
status: in-progress
current-task: PLAN-002
---

# State: Phase 3 - Recipe Suggestion & Ranking

**Plan**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase3-Recipe-Suggestion.md`

**Current Task**: PLAN-003

**Completed Tasks**: PLAN-001, PLAN-002

---

## Task Checklist

- [x] PLAN-001: Create ranking-schema.ts with Zod schema
- [x] PLAN-002: Add RANKING_SYSTEM_PROMPT to prompts.ts
- [ ] PLAN-003: Add buildRankingPrompt function to prompts.ts
- [ ] PLAN-004: Create recipe-ranker.ts service
- [ ] PLAN-005: Extend conversation-service.ts with transitionToSuggesting
- [ ] PLAN-006: Extend session-manager.ts with state update functions
- [ ] PLAN-007: Create RecipeSuggestionCard component
- [ ] PLAN-008: Update ConversationPage to handle suggestions
- [ ] PLAN-009: Add IPC handler for fetching suggestions
- [ ] PLAN-010: Update shared types for suggestions
- [ ] PLAN-011: Write unit tests for recipe-ranker
- [ ] PLAN-012: Write integration tests for suggestion flow
- [ ] PLAN-013: Write component tests for RecipeSuggestionCard

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
npm test recipe-ranker.test.ts
npm test conversation-service.test.ts
npm test RecipeSuggestionCard.test.tsx
```

---

## Acceptance Criteria Verification

### Functional Criteria

- [ ] After gathering context, system queries recipes from database
- [ ] Recipes filtered by time constraint (≤ availableTime)
- [ ] Recipes filtered by dietary constraints (ALL hardRestrictions tags present)
- [ ] AI ranks top 2-4 recipes based on user context
- [ ] Recipe cards displayed in conversation with all required fields
- [ ] Suggestions feel relevant (low energy → simpler recipes)
- [ ] No recipes violate dietary constraints (100% enforcement)

### Technical Criteria

- [ ] Recipe filtering completes in <1 second
- [ ] AI ranking completes in <5 seconds
- [ ] Session state transitions to 'suggesting'
- [ ] Suggested recipe IDs tracked in session
- [ ] Structured output schema validates correctly

### Testing Criteria

- [ ] Unit tests pass for recipe-ranker.ts (>80% coverage)
- [ ] Integration tests pass for transitionToSuggesting flow
- [ ] Component tests pass for RecipeSuggestionCard
- [ ] All tests run successfully
- [ ] Type checking passes
- [ ] Linting passes

---

## Notes

- Plan created: 2026-01-06
- Total tasks: 13
- Estimated duration: 7-10 days (per master plan)
- Prerequisites: Phase 2 complete (conversation-service.ts, session-manager.ts, prompts.ts, ConversationPage.tsx)

---

## Implementation Notes

(Implementor: Add notes here as you work through tasks)

- ***

## Blockers / Issues

(Implementor: Document any blockers or deviations from plan)

- ***

  **Status**: Awaiting implementation start

  **Last Updated**: 2026-01-06
