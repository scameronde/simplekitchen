---
date: 2026-01-06
phase: 3
epic-id: 'EPIC-002'
status: in-progress
current-task: PLAN-002
---

# State: Phase 3 - Recipe Suggestion & Ranking

**Plan**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase3-Recipe-Suggestion.md`

**Current Task**: PLAN-013

**Completed Tasks**: PLAN-001, PLAN-002, PLAN-003, PLAN-004, PLAN-005, PLAN-006, PLAN-007, PLAN-008, PLAN-009, PLAN-010, PLAN-011, PLAN-012

---

## Task Checklist

- [x] PLAN-001: Create ranking-schema.ts with Zod schema
- [x] PLAN-002: Add RANKING_SYSTEM_PROMPT to prompts.ts
- [x] PLAN-003: Add buildRankingPrompt function to prompts.ts
- [x] PLAN-004: Create recipe-ranker.ts service
- [x] PLAN-005: Extend conversation-service.ts with transitionToSuggesting
- [x] PLAN-006: Extend session-manager.ts with state update functions
- [x] PLAN-007: Create RecipeSuggestionCard component
- [x] PLAN-008: Update ConversationPage to handle suggestions
- [x] PLAN-009: Add IPC handler for fetching suggestions
- [x] PLAN-010: Update shared types for suggestions
- [x] PLAN-011: Write unit tests for recipe-ranker
- [x] PLAN-012: Write integration tests for suggestion flow
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

### PLAN-008 Notes (2026-01-06)

- Extended ConversationPage to handle messages with suggestions
- Added RecipeSuggestion type inline (not in shared types yet - will be unified in PLAN-010)
- Implemented recipe data fetching with caching mechanism (fetchedRecipes map)
- Used useEffect to fetch recipe details when suggestions arrive
- Loading skeleton displays while fetching recipe data
- Button handlers are placeholder implementations (console.log) for Phase 4/5
- Backwards compatible with messages without suggestions
- Verification: Type checking and linting passed ✅

### PLAN-009 Notes (2026-01-06)

- Added IPC handler 'conversation:get-suggestions' to conversation-handlers.ts
- Imported transitionToSuggesting from conversation-service
- Implemented security validation using existing validateSender pattern
- Added session validation before processing
- Wrapped business logic in try-catch for error handling
- Returns structured SuggestionResult type (success/error)
- Follows exact same pattern as existing conversation:sendMessage handler
- Verification: Type checking and linting passed ✅

### PLAN-010 Notes (2026-01-06)

- Added RecipeSuggestion interface to shared/types/conversation.ts
- Fields: recipeId, relevanceScore, reasoning, matchedFactors
- Extended ConversationMessage interface with optional suggestions field
- Fully backwards compatible (suggestions field is optional)
- Both suggestedRecipes (Phase 0-2) and suggestions (Phase 3+) fields coexist
- Added comprehensive JSDoc comments with Phase 3+ usage notes
- Unified type definitions across main and renderer processes
- Verification: Type checking and linting passed ✅

### PLAN-011 Notes (2026-01-06)

- Created comprehensive unit test suite for recipe-ranker.ts (725 lines, 21 tests)
- Mocked all dependencies: getSession, getDietaryProfile, getRecipes, OpenAI client
- Followed existing test patterns from recipe-generator.test.ts for OpenAI mocking
- Test coverage includes:
  - Successfully ranks recipes with valid context (multiple scenarios)
  - Throws error when <2 recipes available
  - Filters out already-suggested recipes
  - Enforces dietary constraints in filter
  - Limits candidates to 20 recipes
  - Handles OpenAI errors gracefully (6 error scenarios)
  - Prompt construction validation
  - Edge cases (exactly 2 recipes, missing optional fields)
- All 21 tests passing ✅
- Type checking passed ✅
- Linting passed ✅
- Estimated code coverage: >95% for recipe-ranker.ts

### PLAN-012 Notes (2026-01-06)

- Added integration test suite for transitionToSuggesting in conversation-service.test.ts
- 6 comprehensive integration tests covering the full suggestion flow
- Test approach: Real database + real session-manager + mocked OpenAI only
- Added vi.resetModules() to ensure proper module state sharing
- Test coverage includes:
  - Successful transition from gathering to suggesting with valid context
  - Error when energyLevel is missing
  - Error when availableTime is missing
  - Session state updates to 'suggesting'
  - Suggested recipe IDs tracked in session
  - Returns AI message + suggestions in result
- Integration tests use real database with migrations (3 test recipes created)
- Used dynamic imports with vi.doUnmock() for real module integration
- All 11 tests passing (6 integration + 5 existing unit tests) ✅
- Type checking passed ✅
- Linting passed ✅
- Successfully verified state persistence and transitions

## Blockers / Issues

(Implementor: Document any blockers or deviations from plan)

- ***

  **Status**: Awaiting implementation start

  **Last Updated**: 2026-01-06
