# AI Conversation Recipe Display Bug - Data Structure Mismatch Fix

## Inputs
- **Research report**: `thoughts/shared/research/2026-01-08-AI-Conversation-Recipe-Display-Bug.md`
- **User request**: Fix bug preventing recipe suggestions from displaying in AI conversation interface
- **Root cause**: Backend returns nested object `{ suggestions: { suggestions: [...] } }` instead of flat array `{ suggestions: [...] }`

## Verified Current State

### Fact 1: Backend Returns Nested RecipeSuggestionOutput Object
- **Evidence**: `src/main/conversation/conversation-service.ts:164-168`
- **Excerpt**:
```typescript
return {
  success: true,
  suggestions: result,  // ← result is RecipeSuggestionOutput = { suggestions: [...] }
  aiMessage,
};
```
- **Impact**: The `suggestions` field contains an object with a nested `suggestions` array, not a direct array.

### Fact 2: Zod Schema Defines Nested Structure
- **Evidence**: `src/main/conversation/ranking-schema.ts:3-17`
- **Excerpt**:
```typescript
export const RecipeSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        recipeId: z.string().uuid(),
        relevanceScore: z.number().min(0).max(100),
        reasoning: z.string().min(20).max(500),
        matchedFactors: z.array(z.string()),
      })
    )
    .min(2)
    .max(4),
});

export type RecipeSuggestionOutput = z.infer<typeof RecipeSuggestionSchema>;
```
- **Impact**: `RecipeSuggestionOutput` is `{ suggestions: Array<{...}> }`, not `Array<{...}>`.

### Fact 3: SuggestionResult Interface Declares Nested Type
- **Evidence**: `src/main/conversation/conversation-service.ts:45-50`
- **Excerpt**:
```typescript
export interface SuggestionResult {
  success: boolean;
  suggestions?: RecipeSuggestionOutput;  // ← Nested structure
  aiMessage?: string;
  error?: string;
}
```
- **Impact**: Type system expects nested object, which is incompatible with frontend.

### Fact 4: Frontend Expects Flat Array
- **Evidence**: `src/renderer/pages/ConversationPage.tsx:8-18`
- **Excerpt**:
```typescript
interface RecipeSuggestion {
  recipeId: string;
  relevanceScore: number;
  reasoning: string;
  matchedFactors: string[];
}

// Extended message type to support suggestions
interface ConversationMessageWithSuggestions extends ConversationMessage {
  suggestions?: RecipeSuggestion[];  // ← Expects array directly
}
```
- **Impact**: Frontend cannot iterate over an object; expects an array.

### Fact 5: Both Code Paths Affected
- **Evidence 5a**: `src/main/conversation/conversation-service.ts:164-168` (transitionToSuggesting)
- **Evidence 5b**: `src/main/conversation/conversation-service.ts:268-272` (processRefinement)
- **Excerpt 5a**:
```typescript
// In transitionToSuggesting()
return {
  success: true,
  suggestions: result,  // RecipeSuggestionOutput
  aiMessage,
};
```
- **Excerpt 5b**:
```typescript
// In processRefinement()
return {
  success: true,
  suggestions: result,  // RecipeSuggestionOutput
  aiMessage,
};
```
- **Impact**: Bug affects both initial suggestions and refinement cycles.

### Fact 6: Frontend Render Logic Fails Silently
- **Evidence**: `src/renderer/pages/ConversationPage.tsx:330-333`
- **Excerpt**:
```typescript
{/* Recipe suggestions (if present) */}
{msg.suggestions && msg.suggestions.length > 0 && (
  <div className="mt-4 space-y-3">
    {msg.suggestions.map((suggestion, suggestionIdx) => {
```
- **Impact**: `msg.suggestions.length` evaluates to `undefined` (objects don't have `.length`), condition fails, JSX never renders.

## Goals / Non-Goals

### Goals
- ✅ Fix data structure mismatch between backend and frontend
- ✅ Ensure `SuggestionResult.suggestions` contains a flat array of suggestion objects
- ✅ Update TypeScript types to prevent future regressions
- ✅ Fix both `transitionToSuggesting()` and `processRefinement()` code paths

### Non-Goals
- ❌ Modify AI ranking algorithm or prompts
- ❌ Change Zod schema structure (keep as-is for AI response validation)
- ❌ Modify frontend rendering logic (already correct)
- ❌ Change IPC handler logic (passthrough only)

## Design Overview

### Problem
Backend service receives `RecipeSuggestionOutput` from AI ranker (correctly structured as `{ suggestions: [...] }`), but returns this **entire object** as the `suggestions` field in `SuggestionResult`, creating double-nesting:

```
SuggestionResult = {
  success: true,
  suggestions: {           ← Should be array, not object
    suggestions: [...]     ← Actual array is nested here
  }
}
```

### Solution
**Extract the array** from `RecipeSuggestionOutput` before returning:

```typescript
// Instead of:
return { success: true, suggestions: result, aiMessage };

// Do:
return { success: true, suggestions: result.suggestions, aiMessage };
```

Update the `SuggestionResult` interface to reflect the array type:

```typescript
// Instead of:
suggestions?: RecipeSuggestionOutput;

// Do:
suggestions?: RecipeSuggestionOutput['suggestions'];
```

### Data Flow (After Fix)
1. AI ranker returns `RecipeSuggestionOutput = { suggestions: [...] }`
2. Service extracts `result.suggestions` (the array)
3. Service returns `SuggestionResult = { success: true, suggestions: [...] }`
4. Frontend receives array, checks `.length`, renders recipe cards

## Implementation Instructions (For Implementor)

### PLAN-001: Extract Suggestions Array in transitionToSuggesting()
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.ts`
- **Instruction**:
  1. Locate the `transitionToSuggesting()` function (line ~132)
  2. Find the return statement at line 164-168
  3. Change line 166 from `suggestions: result,` to `suggestions: result.suggestions,`
  4. **Exact change**:
     ```typescript
     // BEFORE (line 166):
     suggestions: result,
     
     // AFTER (line 166):
     suggestions: result.suggestions,
     ```
- **Evidence**: `src/main/conversation/conversation-service.ts:164-168` (current incorrect implementation)
- **Done When**: Line 166 reads `suggestions: result.suggestions,` instead of `suggestions: result,`

### PLAN-002: Extract Suggestions Array in processRefinement()
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.ts`
- **Instruction**:
  1. Locate the `processRefinement()` function (line ~181)
  2. Find the return statement at line 268-272
  3. Change line 270 from `suggestions: result,` to `suggestions: result.suggestions,`
  4. **Exact change**:
     ```typescript
     // BEFORE (line 270):
     suggestions: result,
     
     // AFTER (line 270):
     suggestions: result.suggestions,
     ```
- **Evidence**: `src/main/conversation/conversation-service.ts:268-272` (current incorrect implementation)
- **Done When**: Line 270 reads `suggestions: result.suggestions,` instead of `suggestions: result,`

### PLAN-003: Update SuggestionResult Type Definition
- **Change Type**: modify
- **File**: `src/main/conversation/conversation-service.ts`
- **Instruction**:
  1. Locate the `SuggestionResult` interface definition (line 45-50)
  2. Change line 47 from `suggestions?: RecipeSuggestionOutput;` to `suggestions?: RecipeSuggestionOutput['suggestions'];`
  3. **Exact change**:
     ```typescript
     // BEFORE (line 47):
     suggestions?: RecipeSuggestionOutput;
     
     // AFTER (line 47):
     suggestions?: RecipeSuggestionOutput['suggestions'];
     ```
  4. This uses TypeScript indexed access to extract the array type from the Zod schema
- **Evidence**: `src/main/conversation/conversation-service.ts:45-50` (current incorrect type)
- **Rationale**: TypeScript `RecipeSuggestionOutput['suggestions']` extracts the type of the `suggestions` property (the array), ensuring type safety while avoiding duplication
- **Done When**: Line 47 reads `suggestions?: RecipeSuggestionOutput['suggestions'];`

### PLAN-004: Verify TypeScript Compilation
- **Change Type**: verify
- **File**: (build output)
- **Instruction**:
  1. Run `npm run typecheck` to verify no TypeScript errors
  2. Run `npm run build` to ensure clean build
- **Evidence**: Research report verifies build currently succeeds (no TypeScript errors due to type safety gap)
- **Done When**: Both commands complete with exit code 0 and no errors

### PLAN-005: Run E2E Test for Recipe Suggestions
- **Change Type**: verify
- **File**: `e2e/conversation-suggestions.spec.ts`
- **Instruction**:
  1. Run `npm run test:e2e -- conversation-suggestions.spec.ts`
  2. Verify test passes (recipe cards now render)
  3. If test doesn't exist, verify manually:
     - Start app with `npm run dev`
     - Navigate to conversation page
     - Send message triggering suggestions
     - Verify recipe cards display
- **Evidence**: Research report indicates E2E tests exist for conversation flow
- **Done When**: E2E test passes OR manual verification confirms recipe cards render

## Verification Tasks

No verification tasks needed - all changes are to verified code locations with direct evidence.

## Acceptance Criteria

### Must Have
- [ ] Recipe suggestions display in AI conversation interface after AI determines user is ready
- [ ] Recipe cards show recipe title, relevance score, reasoning, and matched factors
- [ ] Refinement flow (rejecting a recipe) displays new suggestions correctly
- [ ] TypeScript compilation succeeds without errors
- [ ] E2E tests pass (if they exist for this feature)

### Observable Behavior
- User sends message → AI responds → AI transitions to suggestions → **Recipe cards appear** (currently broken)
- User clicks "Not interested" on recipe → AI provides new suggestions → **New recipe cards appear** (currently broken)

### Validation Commands
```bash
npm run typecheck          # No TypeScript errors
npm run build              # Clean build
npm run test:e2e           # E2E tests pass
```

## Implementor Checklist

- [ ] PLAN-001: Extract `result.suggestions` in `transitionToSuggesting()` return statement
- [ ] PLAN-002: Extract `result.suggestions` in `processRefinement()` return statement
- [ ] PLAN-003: Update `SuggestionResult` interface to use indexed access type
- [ ] PLAN-004: Verify TypeScript compilation (typecheck + build)
- [ ] PLAN-005: Run E2E tests for conversation suggestions

## Risk Assessment

### Low Risk
- Changes are minimal (3 lines modified)
- Fix is purely data extraction (no logic changes)
- Type system will catch errors after interface update
- Frontend requires no changes (already correct)

### Regression Surface
- Only affects conversation suggestion display (already broken)
- No impact on other conversation features (chat history, context gathering)
- No database changes
- No IPC protocol changes

## Notes

- Research report verified all file paths and line numbers on 2026-01-08
- Database contains 10 recipes (verified accessible)
- AI ranking service works correctly (returns valid Zod-validated structure)
- Frontend rendering logic works correctly (just needs correct data structure)
- Root cause is simple: forgot to extract array from wrapper object before returning
