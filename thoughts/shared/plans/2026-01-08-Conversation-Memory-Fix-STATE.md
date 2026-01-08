# State: Conversation Memory Loss Fix

**Plan**: thoughts/shared/plans/2026-01-08-Conversation-Memory-Fix.md  
**Current Task**: PLAN-001  
**Completed Tasks**: (none yet)

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
