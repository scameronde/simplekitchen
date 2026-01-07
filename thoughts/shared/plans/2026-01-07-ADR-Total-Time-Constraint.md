# ADR: Total Time Constraint (0-60 Minutes)

## Status

**Accepted** - 2026-01-07

## Context

The original specification (2025-12-25) defined a cooking time constraint of 30-45 minutes for recipes in the SimpleKitchen application. This constraint was part of the "minimal barrier" philosophy to encourage quick, accessible cooking.

However, during implementation and user feedback analysis, several issues emerged:

1. **Overly Restrictive**: A 30-45 minute cooking time window excluded many practical quick recipes (e.g., 15-minute stir-fries, 20-minute pasta dishes)
2. **Semantic Mismatch**: Users think in terms of "total time available" when planning meals, not just active cooking time. A recipe with 5 minutes of prep and 28 minutes of cooking (33 minutes total) would be excluded by a 30-minute cooking time minimum, despite being perfectly suitable for someone with 30 minutes available.
3. **Prep Time Ignored**: The cooking time constraint didn't account for prep time, meaning recipes could have arbitrarily long prep times (e.g., 30 minutes prep + 30 minutes cook = 60 minutes total) while still passing the 30-45 minute cooking time constraint.
4. **UI/Validation Mismatch**: The validation layer accepted 0-60 minute cooking times, while the UI filter slider started at 15 minutes, creating inconsistency.

## Decision

**Enforce a 0-60 minute total time (prep + cook) constraint** at both validation and database levels, while replacing all cooking time filters with total time filters throughout the system.

Specifically:

- **Validation**: Calculate `totalTime = (prepTimeMinutes || 0) + cookingTimeMinutes` and enforce 0 ≤ totalTime ≤ 60
- **Database**: Add CHECK constraint on `total_time_minutes` column to enforce 0-60 range
- **Filters**: Replace `RecipeFilter.cookingTimeMin/Max` with `totalTimeMin/Max` (breaking change)
- **UI**: Update filter sliders to range 0-60 minutes, with defaults remaining at 30-45 to guide users to the "sweet spot"

## Rationale

### 1. Greater Recipe Variety

Expanding from 30-45 minutes to 0-60 minutes allows:

- Quick recipes (15-20 minutes total): Simple salads, sandwiches, basic pasta
- Medium recipes (30-45 minutes total): Original target range
- Longer recipes (50-60 minutes total): Roasted dishes, slow-cooked meals

This provides practical variety while still maintaining the "minimal barrier" philosophy (max 1 hour).

### 2. Total Time Matches Mental Model

When users say "I have 30 minutes to cook," they mean total time from start to eating, not just active cooking time. Filtering by total time:

- **Before**: User with 30 minutes → filters by cookingTimeMax=30 → gets recipes with 30 min cook + 15 min prep = 45 min total ❌
- **After**: User with 30 minutes → filters by totalTimeMax=30 → gets recipes with ≤30 min total ✓

### 3. Prep Time Accountability

By constraining total time instead of cooking time alone:

- Recipes must balance prep and cook time within 60-minute budget
- Prevents pathological cases like 50 min prep + 40 min cook (90 min total) passing validation
- DAL already calculates total time correctly; validation now enforces it

### 4. Consistency Across System

All layers now agree on the constraint:

- Validation: 0-60 total time
- Database: CHECK constraint 0-60 total time
- Filters: Query `total_time_minutes` column
- UI: Slider ranges 0-60, defaults 30-45

## Consequences

### Positive

✅ **Better User Experience**: Filtering by total time matches how users think about meal planning  
✅ **Greater Recipe Variety**: 0-60 minute range accommodates quick snacks through slow-roasted meals  
✅ **Accurate Constraint Enforcement**: Total time constraint prevents prep time from being unbounded  
✅ **System Consistency**: All layers (validation, database, filters, UI) enforce the same constraint  
✅ **Preserved Guidance**: UI defaults of 30-45 minutes still guide users to the original "sweet spot"

### Negative

⚠️ **Breaking API Change**: `RecipeFilter.cookingTimeMin/Max` replaced with `totalTimeMin/Max`

- All consuming code (UI, conversation system, tests) must be updated
- No backward compatibility for existing filter queries

⚠️ **Migration Risk**: If production data exists with `total_time_minutes > 60`, migration will fail

- Mitigation: Assume development environment; provide clear error message
- Future: Add data migration script if needed

⚠️ **Semantic Shift**: "Cooking time" was user-facing terminology in original spec

- Updated all documentation to reference "total time (prep + cook)"
- UI now explicitly shows "Total Time (Prep + Cook)" label

### Trade-offs Accepted

1. **No Backward Compatibility**: Decided against supporting both filter APIs (e.g., deprecated cookingTime + new totalTime) to avoid confusion and maintenance burden
2. **No Retroactive Data Migration**: Focused on development environment; production migration deferred until needed
3. **UI Defaults Unchanged**: Kept 30-45 minute defaults even though range is now 0-60, to preserve original UX intent

## Implementation

See: [`thoughts/shared/plans/2026-01-07-Total-Time-Constraint-Enforcement.md`](./2026-01-07-Total-Time-Constraint-Enforcement.md)

### Key Changes

1. **Validation Layer** (`src/main/validation/time-validator.ts`):
   - Renamed constants: `MIN_TOTAL_TIME = 0`, `MAX_TOTAL_TIME = 60`
   - Calculate `totalTime = (prepTimeMinutes || 0) + cookingTimeMinutes`
   - Validate total time instead of cooking time alone
   - Error messages reference "total time (prep + cook)"

2. **Database Layer** (`src/main/database/migrations.ts`):
   - Added CHECK constraint: `total_time_minutes INTEGER NOT NULL CHECK(total_time_minutes >= 0 AND total_time_minutes <= 60)`

3. **Type Definitions** (`src/shared/types/recipe.ts`):
   - Replaced `RecipeFilter.cookingTimeMin/Max` with `totalTimeMin/Max`

4. **Data Access Layer** (`src/main/database/dal/recipes.ts`):
   - Updated filter queries to use `total_time_minutes` column

5. **UI Components**:
   - FilterControls slider: `min="0" max="60"` (defaults 30-45)
   - Label: "Total Time (Prep + Cook)"

6. **Conversation System** (`src/main/conversation/recipe-ranker.ts`):
   - Filters use `totalTimeMax` when user specifies available time

7. **Test Data**:
   - Benchmark data generation fixed to ensure total ≤ 60
   - Seed data verified to comply (already did)

## Alternatives Considered

### Option A: Keep 30-45 Cooking Time (Rejected)

- **Pros**: No breaking changes, matches original spec literally
- **Cons**: Too restrictive, excludes practical quick recipes, semantic mismatch with user mental model
- **Rejected**: User feedback indicated constraint was impractical

### Option B: Expand to 0-90 Total Time (Rejected)

- **Pros**: Even more recipe variety
- **Cons**: Violates "minimal barrier" philosophy (90 minutes is not "quick"), dilutes app's value proposition
- **Rejected**: 60 minutes balances variety with "quick cooking" brand

### Option C: Separate Constraints (Cooking ≤60, Total ≤90) (Rejected)

- **Pros**: Maximum flexibility
- **Cons**: Complex to explain, UI would need two sliders, unclear which constraint users care about
- **Rejected**: Total time is the meaningful constraint for users

### Option D: Support Both Filter APIs (Rejected)

- **Pros**: Backward compatibility
- **Cons**: Confusing semantics (does cookingTimeMax mean total or cooking only?), maintenance burden
- **Rejected**: Clean break preferred over deprecated API

## References

- Original Specification: 30-45 minute cooking time constraint (2025-12-25)
- Implementation Plan: `thoughts/shared/plans/2026-01-07-Total-Time-Constraint-Enforcement.md`
- Research Report: `thoughts/shared/research/2026-01-07-Cooking-Time-Constraints-Audit.md`
- User Requirement: Total time (prep + cook) must be 0-60 minutes, not just cooking time

## Related Decisions

- **Decision 13**: Cookware Type Constraint (single enum, mutually exclusive)
- **Decision 9**: Recipe Adaptation for Dietary Constraints (reject non-compliant recipes)

Both decisions share the "simplicity with constraints" philosophy that guides SimpleKitchen's design.
