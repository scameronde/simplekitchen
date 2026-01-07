# Total Time Constraint Enforcement - Implementation Plan

## Inputs

- **Research report**: `thoughts/shared/research/2026-01-07-Cooking-Time-Constraints-Audit.md`
- **User requirement**: Total time (prep + cook) must be 0-60 minutes, not just cooking time
- **User clarification**: UI slider should start at 0, not 15
- **Rationale**: Original 30-45 minute constraint was too restrictive for practical use

## Verified Current State

### Finding 1: Validation Only Checks Cooking Time

**Fact**: Time validator defines MIN_COOKING_TIME=0, MAX_COOKING_TIME=60 but only validates cookingTimeMinutes field, not total time.

**Evidence**: `src/main/validation/time-validator.ts:4-5, 18-38`

**Excerpt**:
```typescript
const MIN_COOKING_TIME = 0;
const MAX_COOKING_TIME = 60;

// Validate minimum cooking time (0 minutes or positive)
if (cookingTime < MIN_COOKING_TIME) {
  errors.push({
    field: 'cookingTimeMinutes',
    constraint: 'time-minimum',
    message: `Cooking time must be at least ${MIN_COOKING_TIME} minutes...`,
  });
}

// Validate maximum cooking time (60 minutes)
if (cookingTime > MAX_COOKING_TIME) {
  errors.push({
    field: 'cookingTimeMinutes',
    constraint: 'time-maximum',
    message: `Cooking time must be at most ${MAX_COOKING_TIME} minutes...`,
  });
}
```

**Current Behavior**: A recipe with prepTimeMinutes=30 and cookingTimeMinutes=60 (total=90 minutes) would pass validation. This violates the intended constraint.

### Finding 2: Database Has No Total Time Constraint

**Fact**: Database schema has CHECK constraint on cooking_time_minutes (0-60) but not on total_time_minutes.

**Evidence**: `src/main/database/migrations.ts:46-48`

**Excerpt**:
```sql
cooking_time_minutes INTEGER NOT NULL CHECK(cooking_time_minutes >= 0 AND cooking_time_minutes <= 60),
prep_time_minutes INTEGER,
total_time_minutes INTEGER NOT NULL,
```

**Current Behavior**: Database accepts any total_time_minutes value, including > 60.

### Finding 3: DAL Correctly Calculates Total Time

**Fact**: DAL layer calculates total_time_minutes = (prepTimeMinutes || 0) + cookingTimeMinutes on create and update.

**Evidence**: `src/main/database/dal/recipes.ts:39, 183-188`

**Excerpt**:
```typescript
// CREATE
const totalTime = (input.prepTimeMinutes || 0) + input.cookingTimeMinutes;

// UPDATE
if (input.prepTimeMinutes !== undefined) {
  updates.prep_time_minutes = input.prepTimeMinutes;
  updates.total_time_minutes = input.prepTimeMinutes + existing.cookingTimeMinutes;
}
```

**Current Behavior**: Total time is correctly calculated but not validated against constraint.

### Finding 4: Filters Use Cooking Time, Not Total Time

**Fact**: RecipeFilter interface defines cookingTimeMin/cookingTimeMax, and DAL queries cooking_time_minutes column.

**Evidence**: `src/shared/types/recipe.ts:96-98`, `src/main/database/dal/recipes.ts:124-128`

**Excerpt**:
```typescript
// Type definition
export interface RecipeFilter {
  cookingTimeMin?: number;
  cookingTimeMax?: number;
  // ...
}

// DAL query
if (filter.cookingTimeMin !== undefined) {
  query = query.where('cooking_time_minutes', '>=', filter.cookingTimeMin);
}
if (filter.cookingTimeMax !== undefined) {
  query = query.where('cooking_time_minutes', '<=', filter.cookingTimeMax);
}
```

**Current Behavior**: Users filter by cooking time only, excluding recipes with short cook time but long prep time.

### Finding 5: UI Slider Starts at 15 Minutes

**Fact**: FilterControls component renders time sliders with min=15, max=60, defaulting to 30-45.

**Evidence**: `src/renderer/components/RecipeList/FilterControls.tsx:23-24, 88-103`

**Excerpt**:
```typescript
const [minTime, setMinTime] = useState(initialFilters?.cookingTimeMin ?? 30);
const [maxTime, setMaxTime] = useState(initialFilters?.cookingTimeMax ?? 45);

<input type="range" min="15" max="60" value={minTime} />
<input type="range" min="15" max="60" value={maxTime} />
```

**Current Behavior**: Recipes with 0-14 minute cooking times cannot be filtered via UI slider. Mismatch with validation (accepts 0).

### Finding 6: Conversation System Uses cookingTimeMax Filter

**Fact**: Recipe ranker uses userContext.availableTime for cookingTimeMax filter.

**Evidence**: `src/main/conversation/recipe-ranker.ts:60-65`

**Excerpt**:
```typescript
const filter: RecipeFilter = {
  dietaryTags:
    dietaryProfile.hardRestrictions.length > 0 ? dietaryProfile.hardRestrictions : undefined,
  cookingTimeMax: userContext.availableTime,
  // cookwareTypes left undefined to let AI rank all types
};
```

**Current Behavior**: When user says "I have 30 minutes", system filters by cooking time, not total time. Recipes with 5 min prep + 28 min cook (33 total) would be excluded.

### Finding 7: Benchmark Data Violates New Constraint

**Fact**: Benchmark suite generates recipes with prepTimeMinutes=10-19 and cookingTimeMinutes=30-45, yielding total up to 64 minutes.

**Evidence**: `src/main/database/benchmark-suite.ts:42, 50`

**Excerpt**:
```typescript
const cookingTime = 30 + (index % 16); // Range: 30-45 minutes
prepTimeMinutes: 10 + (index % 10), // Range: 10-19 minutes
```

**Current Behavior**: Benchmark data generation will fail after migration adds CHECK constraint.

### Finding 8: Seed Data Complies With New Constraint

**Fact**: All three seed recipes have total time ≤ 60 minutes.

**Evidence**: `src/main/database/seed-data.ts:7-8, 53-54, 107-108`

**Excerpt**:
```typescript
// Recipe 1: prep=15, cook=30, total=45
cookingTimeMinutes: 30,
prepTimeMinutes: 15,

// Recipe 2: prep=10, cook=35, total=45
cookingTimeMinutes: 35,
prepTimeMinutes: 10,

// Recipe 3: prep=10, cook=40, total=50
cookingTimeMinutes: 40,
prepTimeMinutes: 10,
```

**Current Behavior**: Seed data will pass new validation.

## Goals / Non-Goals

### Goals

1. **Enforce 0-60 minute total time constraint** at validation and database levels
2. **Replace cooking time filters with total time filters** throughout the system (breaking change)
3. **Update UI to filter by total time** with slider range 0-60 minutes
4. **Fix benchmark data generation** to comply with new constraint
5. **Update all documentation** to clarify total time = prep + cook ≤ 60 minutes

### Non-Goals

1. **Migrate existing user data** - assume development environment only; if production data exists with total > 60, migration will fail with clear error
2. **Support backward compatibility** for cookingTime filters - this is a breaking change
3. **Retroactively document constraint evolution history** - focus on current state, not historical timeline

## Design Overview

### Constraint Enforcement Flow

```
User Input (prepTimeMinutes, cookingTimeMinutes)
    ↓
Validation Layer: Check (prep || 0) + cook ∈ [0, 60]
    ↓
DAL Layer: Calculate total_time_minutes
    ↓
Database Layer: CHECK constraint enforces total_time_minutes ∈ [0, 60]
```

### Filter Semantics Change

**Before**: Filter by cooking time only (semantic mismatch)
```
User says "I have 30 minutes"
  → Filter: cookingTimeMax = 30
  → Query: WHERE cooking_time_minutes <= 30
  → Result: Recipes with cook ≤ 30 (but total might be 50+)
```

**After**: Filter by total time (correct semantics)
```
User says "I have 30 minutes"
  → Filter: totalTimeMax = 30
  → Query: WHERE total_time_minutes <= 30
  → Result: Recipes with (prep + cook) ≤ 30
```

## Implementation Instructions

### PLAN-001: Update Validation Constants and Logic

**Change Type**: modify

**File**: `src/main/validation/time-validator.ts`

**Instruction**:
1. Rename constants: `MIN_COOKING_TIME` → `MIN_TOTAL_TIME`, `MAX_COOKING_TIME` → `MAX_TOTAL_TIME`
2. Update `validateTimeConstraints()` function:
   - After line 18 (cookingTime assignment), calculate `totalTime = (recipeInput.prepTimeMinutes || 0) + cookingTime`
   - Replace MIN_COOKING_TIME/MAX_COOKING_TIME checks with MIN_TOTAL_TIME/MAX_TOTAL_TIME checks on `totalTime` variable
   - Update error messages to reference "total time (prep + cook)" instead of "cooking time"
   - Update field in ValidationError to 'totalTimeMinutes' (conceptual field, not DB column)
   - Update suggestedFix messages to mention reducing prep time or cook time
3. Update `getTimeConstraints()` function to return `{ min: MIN_TOTAL_TIME, max: MAX_TOTAL_TIME }`
4. Add JSDoc comment explaining total time = prep + cook

**Pseudocode**:
```typescript
const MIN_TOTAL_TIME = 0;
const MAX_TOTAL_TIME = 60;

export function validateTimeConstraints(
  recipeInput: CreateRecipeInput | UpdateRecipeInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (recipeInput.cookingTimeMinutes === undefined) {
    return errors;
  }

  const cookingTime = recipeInput.cookingTimeMinutes;
  const prepTime = recipeInput.prepTimeMinutes || 0;
  const totalTime = prepTime + cookingTime;

  // Validate total time range
  if (totalTime < MIN_TOTAL_TIME) {
    errors.push({
      field: 'totalTimeMinutes',
      constraint: 'time-minimum',
      message: `Total time (prep + cook) must be at least ${MIN_TOTAL_TIME} minutes. Current: ${prepTime} min prep + ${cookingTime} min cook = ${totalTime} min total.`,
      suggestedFix: 'Ensure prep and cook times are non-negative.',
    });
  }

  if (totalTime > MAX_TOTAL_TIME) {
    errors.push({
      field: 'totalTimeMinutes',
      constraint: 'time-maximum',
      message: `Total time (prep + cook) must be at most ${MAX_TOTAL_TIME} minutes. Current: ${prepTime} min prep + ${cookingTime} min cook = ${totalTime} min total.`,
      suggestedFix: `Reduce prep time or cook time so total is ≤ ${MAX_TOTAL_TIME} minutes.`,
    });
  }

  return errors;
}
```

**Evidence**: `src/main/validation/time-validator.ts:4-49` (entire file needs update)

**Done When**:
- Constants renamed to MIN_TOTAL_TIME/MAX_TOTAL_TIME
- Validation checks total time instead of cooking time only
- Error messages reference "total time (prep + cook)"
- `npm run typecheck` passes

---

### PLAN-002: Update Validation Tests

**Change Type**: modify

**File**: `src/main/validation/time-validator.test.ts`

**Instruction**:
1. Update test cases to cover total time scenarios:
   - Valid: prep=0, cook=0, total=0
   - Valid: prep=10, cook=50, total=60
   - Valid: prep=null, cook=60, total=60
   - Invalid: prep=30, cook=35, total=65
   - Invalid: prep=10, cook=55, total=65
2. Update test expectations:
   - Error field should be 'totalTimeMinutes'
   - Error messages should reference "total time (prep + cook)"
3. Remove or update tests checking cooking time in isolation (no longer relevant)

**Pseudocode**:
```typescript
it('should accept valid total time (prep + cook = 60)', () => {
  const recipe = { ...baseRecipe, prepTimeMinutes: 10, cookingTimeMinutes: 50 };
  const errors = validateTimeConstraints(recipe as CreateRecipeInput);
  expect(errors).toHaveLength(0);
});

it('should reject total time above 60 minutes', () => {
  const recipe = { ...baseRecipe, prepTimeMinutes: 30, cookingTimeMinutes: 35 };
  const errors = validateTimeConstraints(recipe as CreateRecipeInput);
  expect(errors).toHaveLength(1);
  expect(errors[0]!.constraint).toBe('time-maximum');
  expect(errors[0]!.message).toContain('total time (prep + cook)');
  expect(errors[0]!.message).toContain('30 min prep + 35 min cook = 65 min total');
});
```

**Evidence**: `src/main/validation/time-validator.test.ts:12-62` (test cases need update)

**Done When**:
- All tests updated to validate total time scenarios
- Tests check for 'totalTimeMinutes' field in errors
- `npm test src/main/validation/time-validator.test.ts` passes

---

### PLAN-003: Add Database CHECK Constraint

**Change Type**: modify

**File**: `src/main/database/migrations.ts`

**Instruction**:
1. Locate the CREATE TABLE statement for recipes (around line 43)
2. Locate the total_time_minutes column definition (line 48)
3. Add CHECK constraint: `total_time_minutes INTEGER NOT NULL CHECK(total_time_minutes >= 0 AND total_time_minutes <= 60)`
4. Add comment above explaining: "Total time (prep + cook) must be 0-60 minutes"
5. IMPORTANT: This migration is **breaking** if any existing data has total > 60
   - On migration failure, user must manually fix data or regenerate database

**Interfaces / Pseudocode**:
```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cooking_time_minutes INTEGER NOT NULL CHECK(cooking_time_minutes >= 0 AND cooking_time_minutes <= 60),
  prep_time_minutes INTEGER,
  -- Total time (prep + cook) must be 0-60 minutes
  total_time_minutes INTEGER NOT NULL CHECK(total_time_minutes >= 0 AND total_time_minutes <= 60),
  cookware_type TEXT NOT NULL CHECK(cookware_type IN ('one-pot', 'one-pan', 'oven')),
  -- ...
)
```

**Evidence**: `src/main/database/migrations.ts:46-48` (total_time_minutes column definition)

**Done When**:
- CHECK constraint added to total_time_minutes column
- Comment added explaining constraint
- `npm run typecheck` passes
- Migration runs successfully on clean database: `rm -f simplekitchen.db && npm run dev` (verify in Electron app)

---

### PLAN-004: Update RecipeFilter Type Definition

**Change Type**: modify (breaking)

**File**: `src/shared/types/recipe.ts`

**Instruction**:
1. Locate RecipeFilter interface (line 95-103)
2. Replace `cookingTimeMin?: number;` with `totalTimeMin?: number;`
3. Replace `cookingTimeMax?: number;` with `totalTimeMax?: number;`
4. Add JSDoc comment: `@remarks totalTimeMin/totalTimeMax filter on total_time_minutes (prep + cook) column`

**Interfaces / Pseudocode**:
```typescript
/**
 * Recipe filter criteria
 * @remarks totalTimeMin/totalTimeMax filter on total_time_minutes (prep + cook) column
 */
export interface RecipeFilter {
  totalTimeMin?: number;
  totalTimeMax?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[]; // Recipes must have ALL specified tags
  seasonality?: Season[]; // Recipes matching ANY specified season
  sourceTypes?: SourceType[];
}
```

**Evidence**: `src/shared/types/recipe.ts:95-103` (RecipeFilter interface)

**Done When**:
- cookingTimeMin/Max replaced with totalTimeMin/Max
- JSDoc comment added
- `npm run typecheck` shows errors in consuming files (expected; will fix in next tasks)

---

### PLAN-005: Update DAL Filter Logic

**Change Type**: modify

**File**: `src/main/database/dal/recipes.ts`

**Instruction**:
1. Locate getRecipes() function filter application (lines 124-128)
2. Replace `filter.cookingTimeMin` check with `filter.totalTimeMin`, query `total_time_minutes` column
3. Replace `filter.cookingTimeMax` check with `filter.totalTimeMax`, query `total_time_minutes` column
4. Update variable names for clarity: `filter.totalTimeMin` → query on `'total_time_minutes'`

**Pseudocode**:
```typescript
// Apply filters
if (filter) {
  if (filter.totalTimeMin !== undefined) {
    query = query.where('total_time_minutes', '>=', filter.totalTimeMin);
  }
  if (filter.totalTimeMax !== undefined) {
    query = query.where('total_time_minutes', '<=', filter.totalTimeMax);
  }
  // ... other filters
}
```

**Evidence**: `src/main/database/dal/recipes.ts:124-128` (filter application)

**Done When**:
- DAL queries total_time_minutes instead of cooking_time_minutes
- `npm run typecheck` passes (after UI and conversation updates)

---

### PLAN-006: Update UI FilterControls Component

**Change Type**: modify

**File**: `src/renderer/components/RecipeList/FilterControls.tsx`

**Instruction**:
1. Update state variable initialization (lines 23-24):
   - Replace `initialFilters?.cookingTimeMin ?? 30` with `initialFilters?.totalTimeMin ?? 30`
   - Replace `initialFilters?.cookingTimeMax ?? 45` with `initialFilters?.totalTimeMax ?? 45`
2. Update handleClearFilters() function (lines 66-72):
   - Replace `cookingTimeMin: 30` with `totalTimeMin: 30`
   - Replace `cookingTimeMax: 45` with `totalTimeMax: 45`
3. Update slider inputs (lines 88-103):
   - Change `min="15"` to `min="0"` for both sliders
   - Keep `max="60"`
4. Update label text (find "Cooking Time" label):
   - Replace "Cooking Time" with "Total Time (Prep + Cook)"
5. Update onFilterChange call to use totalTimeMin/totalTimeMax

**Pseudocode**:
```typescript
const [minTime, setMinTime] = useState(initialFilters?.totalTimeMin ?? 30);
const [maxTime, setMaxTime] = useState(initialFilters?.totalTimeMax ?? 45);

const handleClearFilters = () => {
  setMinTime(30);
  setMaxTime(45);
  setSelectedCookware([]);
  setSelectedDietary([]);
  onFilterChange({
    totalTimeMin: 30,
    totalTimeMax: 45,
    cookwareTypes: [],
    dietaryTags: [],
  });
};

<input type="range" min="0" max="60" value={minTime} />
<input type="range" min="0" max="60" value={maxTime} />
```

**Evidence**: `src/renderer/components/RecipeList/FilterControls.tsx:23-24, 66-72, 88-103`

**Done When**:
- Slider min changed from 15 to 0
- Filter fields renamed to totalTimeMin/totalTimeMax
- Label updated to "Total Time (Prep + Cook)"
- `npm run typecheck` passes

---

### PLAN-007: Update UI RecipeListPage Component

**Change Type**: modify

**File**: `src/renderer/pages/RecipeListPage.tsx`

**Instruction**:
1. Locate currentFilters state initialization (lines 15-16)
2. Replace `cookingTimeMin: 30` with `totalTimeMin: 30`
3. Replace `cookingTimeMax: 45` with `totalTimeMax: 45`

**Pseudocode**:
```typescript
const [currentFilters, setCurrentFilters] = useState<FilterState>({
  totalTimeMin: 30,
  totalTimeMax: 45,
  cookwareTypes: [],
  dietaryTags: [],
});
```

**Evidence**: `src/renderer/pages/RecipeListPage.tsx:15-16`

**Done When**:
- Filter initialization uses totalTimeMin/totalTimeMax
- `npm run typecheck` passes

---

### PLAN-008: Update Conversation Recipe Ranker

**Change Type**: modify

**File**: `src/main/conversation/recipe-ranker.ts`

**Instruction**:
1. Locate filter construction in rankRecipes() function (line 63)
2. Replace `cookingTimeMax: userContext.availableTime` with `totalTimeMax: userContext.availableTime`
3. Update comment (line 64) to clarify filtering by total time, not just cooking time

**Pseudocode**:
```typescript
const filter: RecipeFilter = {
  dietaryTags:
    dietaryProfile.hardRestrictions.length > 0 ? dietaryProfile.hardRestrictions : undefined,
  totalTimeMax: userContext.availableTime, // Filter by total time (prep + cook)
  // cookwareTypes left undefined to let AI rank all types
};
```

**Evidence**: `src/main/conversation/recipe-ranker.ts:60-65`

**Done When**:
- Conversation system filters by total time
- Comment updated
- `npm run typecheck` passes

---

### PLAN-009: Fix Benchmark Data Generation

**Change Type**: modify

**File**: `src/main/database/benchmark-suite.ts`

**Instruction**:
1. Locate generateRecipe() function (around line 42-50)
2. Update prepTimeMinutes calculation to ensure prep + cook ≤ 60:
   - Current: `prepTimeMinutes: 10 + (index % 10)` yields 10-19
   - Current: `cookingTime = 30 + (index % 16)` yields 30-45
   - Maximum total: 19 + 45 = 64 (violates constraint)
3. Fix: Change to `prepTimeMinutes: 5 + (index % 11)` yields 5-15
   - New maximum total: 15 + 45 = 60 ✓
4. OR: Change to `prepTimeMinutes: index % 16` yields 0-15
   - New maximum total: 15 + 45 = 60 ✓

**Pseudocode**:
```typescript
const cookingTime = 30 + (index % 16); // Range: 30-45 minutes
const prepTime = index % 16; // Range: 0-15 minutes (ensures total ≤ 60)

return {
  title: `Benchmark Recipe ${index + 1}`,
  cookingTimeMinutes: cookingTime,
  prepTimeMinutes: prepTime,
  // ...
};
```

**Evidence**: `src/main/database/benchmark-suite.ts:42, 50`

**Done When**:
- Benchmark recipes have total time ≤ 60 minutes
- `npm run benchmark` completes without validation errors

---

### PLAN-010: Update Benchmark Filter Queries

**Change Type**: modify

**File**: `src/main/database/benchmark-suite.ts`

**Instruction**:
1. Locate benchmark query definitions using RecipeFilter (around lines 144-154)
2. Replace `cookingTimeMin: 30` with `totalTimeMin: 30`
3. Replace `cookingTimeMax: 45` with `totalTimeMax: 45`
4. Update benchmark name from "Query with Time Filter (30-45 min)" to "Query with Total Time Filter (30-45 min)"

**Pseudocode**:
```typescript
const filter: RecipeFilter = {
  totalTimeMin: 30,
  totalTimeMax: 45,
};

return {
  name: 'Query with Total Time Filter (30-45 min)',
  // ...
};
```

**Evidence**: `src/main/database/benchmark-suite.ts:144-154`

**Done When**:
- Benchmark queries use totalTimeMin/totalTimeMax
- Benchmark names updated
- `npm run benchmark` completes successfully

---

### PLAN-011: Update Unit Tests Using RecipeFilter

**Change Type**: modify

**Files**: 
- `src/main/database/dal/recipes.test.ts`
- `src/main/conversation/recipe-ranker.test.ts` (if exists)
- Any other test files importing RecipeFilter

**Instruction**:
1. Search all test files for usages of `cookingTimeMin` or `cookingTimeMax`
2. Replace with `totalTimeMin` and `totalTimeMax`
3. Update test descriptions to reference "total time" instead of "cooking time"
4. Verify test data (recipe fixtures) comply with total time ≤ 60 constraint

**Evidence**: Use `grep -r "cookingTimeMin\|cookingTimeMax" src/main/ src/renderer/ --include="*.test.ts"` to find all usages

**Done When**:
- All test files updated
- `npm run test:unit` passes

---

### PLAN-012: Update E2E Tests

**Change Type**: modify

**Files**:
- `e2e/cross-feature-workflows.spec.ts`
- `e2e/performance.spec.ts`
- Any other E2E tests using time filters

**Instruction**:
1. Update performance tests (e2e/performance.spec.ts:59-70):
   - Update comments from "Time Filter Performance (30-40 minutes)" to "Total Time Filter Performance (30-40 minutes)"
   - Verify slider interactions still work with min=0
2. Update cross-feature workflows (e2e/cross-feature-workflows.spec.ts):
   - Line 240: Update comment from "default filter is 30-45 minutes" to "default filter is 30-45 minutes total time"
   - Verify validation error tests still work (75-minute reject test at line 216-228)
3. Check for any UI label assertions looking for "Cooking Time" text, update to "Total Time"

**Evidence**: 
- `e2e/performance.spec.ts:59-70`
- `e2e/cross-feature-workflows.spec.ts:240, 216-228`

**Done When**:
- All E2E tests updated
- `npm run test:e2e` passes

---

### PLAN-013: Update User Guide Documentation

**Change Type**: modify

**File**: `docs/user-guide.md`

**Instruction**:
1. Line 14: Update "Cooking Time" to "Total Time (Prep + Cook)" in field list
2. Line 43: Update validation rules section:
   - Change "**Cooking Time**: 0-60 minutes" to "**Total Time**: 0-60 minutes (prep + cook combined)"
3. Lines 51-53: Update error message text:
   - Change "Cooking time must be between 0-60 minutes" to "Total time must be between 0-60 minutes"
   - Update resolution: "Adjust your prep time or cooking time so the total is ≤ 60 minutes"
4. Lines 99-100: Update filter documentation:
   - Change "#### Cooking Time Filter" to "#### Total Time Filter"
   - Update description: "Filter recipes by total time (prep + cook combined)"
   - Range remains 0-60, default remains 30-45 (but clarify it's total time)

**Evidence**: `docs/user-guide.md:14, 43, 51, 53, 99-100`

**Done When**:
- All references updated from "cooking time" to "total time"
- Clarification added that total = prep + cook
- Documentation accurately reflects UI and validation

---

### PLAN-014: Update Manual Entry User Guide

**Change Type**: modify

**File**: `docs/user-guide-manual-entry.md`

**Instruction**:
1. Apply same changes as PLAN-013 (user-guide.md) to this file
2. Lines 12, 41, 49, 51: Update references to cooking time constraint
3. Ensure examples clarify total time = prep + cook

**Evidence**: `docs/user-guide-manual-entry.md:12, 41, 49, 51`

**Done When**:
- Documentation matches user-guide.md updates
- Total time constraint clearly explained

---

### PLAN-015: Update Web Import User Guide

**Change Type**: modify

**File**: `docs/user-guide-web-import.md`

**Instruction**:
1. Line 154: Update error cause text:
   - Change "cooking time outside 0-60 minutes" to "total time (prep + cook) outside 0-60 minutes"
2. Lines 158-159: Update resolution steps:
   - Change "Cooking Time: Adjust the cooking time to fit between 0-60 minutes"
   - To: "Total Time: Adjust prep and/or cooking time so total is 0-60 minutes"
   - Update "If the recipe is too slow (over 60 minutes)" to clarify total time

**Evidence**: `docs/user-guide-web-import.md:154, 158-159`

**Done When**:
- Web import documentation reflects total time constraint
- Users understand imported recipes are validated on total time

---

### PLAN-016: Update Validation README

**Change Type**: modify

**File**: `src/main/validation/README.md`

**Instruction**:
1. Line 38: Update constraint documentation:
   - Change "**Maximum**: 60 minutes" 
   - To: "**Total Time Constraint**: 0-60 minutes (prep + cook combined)"
2. Add explanation that prepTimeMinutes is optional (nullable) and defaults to 0 for calculation
3. Update any examples to show total time validation

**Evidence**: `src/main/validation/README.md:38`

**Done When**:
- README accurately documents total time constraint
- Examples show prep + cook calculation

---

### PLAN-017: Update Database README

**Change Type**: modify

**File**: `src/main/database/README.md`

**Instruction**:
1. Lines 38, 45: Update constraints and indexes documentation:
   - Change "`cooking_time_minutes`: Must be 0-60 (spec requirement)"
   - To: "`total_time_minutes`: Must be 0-60 (total of prep + cook, spec requirement)"
   - Add: "`cooking_time_minutes`: Must be 0-60 (individual constraint, but total time is the binding constraint)"
2. Clarify that total_time_minutes is a calculated/stored column, not a generated column

**Evidence**: `src/main/database/README.md:38, 45`

**Done When**:
- Database documentation explains both cooking and total time constraints
- Relationship between fields clarified

---

### PLAN-018: Update Epic Completion Report

**Change Type**: modify

**File**: `thoughts/shared/plans/2026-01-02-Recipe-Collection-EPIC-COMPLETE.md`

**Instruction**:
1. Line 120: Update acceptance criteria AC-F5:
   - Change "✅ **AC-F5**: Time constraint (30-45 min) and cookware limit (1 item) enforcement working"
   - To: "✅ **AC-F5**: Time constraint (0-60 min total time) and cookware limit (1 item) enforcement working"
2. Add note explaining that original 30-45 range was expanded to 0-60 for practical use, with UI defaults remaining 30-45

**Evidence**: `thoughts/shared/plans/2026-01-02-Recipe-Collection-EPIC-COMPLETE.md:120`

**Done When**:
- Epic documentation reflects current implementation
- Discrepancy between original spec and current state documented

---

### PLAN-019: Add ADR for Constraint Evolution

**Change Type**: create

**File**: `thoughts/shared/plans/2026-01-07-ADR-Total-Time-Constraint.md`

**Instruction**:
Create an Architecture Decision Record documenting:
1. **Context**: Original spec defined 30-45 minute cooking time constraint
2. **Decision**: Expanded to 0-60 minute total time (prep + cook) constraint
3. **Rationale**: 30-45 minutes too restrictive for practical use; total time is more meaningful than cooking time alone
4. **Consequences**:
   - UI defaults remain 30-45 to guide users to "sweet spot"
   - Validation and database enforce 0-60 total time
   - Filters use total time, not cooking time (breaking change)
5. **Date**: 2026-01-07
6. **Status**: Accepted

**Pseudocode**:
```markdown
# ADR: Total Time Constraint (0-60 Minutes)

## Status
Accepted - 2026-01-07

## Context
Original specification (2025-12-25) defined cooking time constraint as 30-45 minutes...

## Decision
Enforce 0-60 minute total time (prep + cook) constraint at validation and database levels...

## Rationale
1. 30-45 minutes too restrictive for practical recipe variety
2. Total time more meaningful than cooking time alone for user planning
3. Allows quick recipes (15-20 min total) and longer recipes (50-60 min total)

## Consequences
### Positive
- Greater recipe variety within constraint
- Better user experience (filter by total time matches mental model)

### Negative
- Breaking change to RecipeFilter API
- All consuming code must be updated

## Implementation
See: thoughts/shared/plans/2026-01-07-Total-Time-Constraint-Enforcement.md
```

**Done When**:
- ADR file created with complete context
- Linked from main implementation plan

---

## Verification Tasks

None - all requirements verified via research report.

## Acceptance Criteria

1. **Validation Enforces Total Time**:
   - Recipe with prep=30, cook=35 (total=65) rejected with clear error message
   - Recipe with prep=10, cook=50 (total=60) accepted
   - Error messages reference "total time (prep + cook)"

2. **Database Enforces Total Time**:
   - Direct SQL INSERT with total_time_minutes=65 rejected by CHECK constraint
   - Migration runs successfully on clean database
   - Seed data loads without errors

3. **Filters Use Total Time**:
   - UI filter with totalTimeMax=30 shows only recipes where (prep + cook) ≤ 30
   - Conversation system with "I have 30 minutes" filters by total time
   - No references to cookingTimeMin/Max in RecipeFilter type

4. **UI Slider Starts at 0**:
   - Time filter slider min value is 0, max value is 60
   - Slider defaults to 30-45 range
   - Label reads "Total Time (Prep + Cook)"

5. **Test Data Complies**:
   - All seed recipes have total ≤ 60
   - Benchmark data generation produces total ≤ 60
   - `npm run seed:db` completes successfully
   - `npm run benchmark` completes successfully

6. **All Tests Pass**:
   - `npm run test:unit` passes
   - `npm run test:integration` passes
   - `npm run test:e2e` passes
   - `npm run typecheck` passes
   - `npm run lint` passes

7. **Documentation Updated**:
   - User guides reference total time constraint
   - Technical docs (validation, database READMEs) explain total time = prep + cook
   - Epic completion report corrected
   - ADR created documenting decision

## Implementor Checklist

- [ ] PLAN-001: Update validation constants and logic
- [ ] PLAN-002: Update validation tests
- [ ] PLAN-003: Add database CHECK constraint
- [ ] PLAN-004: Update RecipeFilter type definition
- [ ] PLAN-005: Update DAL filter logic
- [ ] PLAN-006: Update UI FilterControls component
- [ ] PLAN-007: Update UI RecipeListPage component
- [ ] PLAN-008: Update conversation recipe ranker
- [ ] PLAN-009: Fix benchmark data generation
- [ ] PLAN-010: Update benchmark filter queries
- [ ] PLAN-011: Update unit tests using RecipeFilter
- [ ] PLAN-012: Update E2E tests
- [ ] PLAN-013: Update user guide documentation
- [ ] PLAN-014: Update manual entry user guide
- [ ] PLAN-015: Update web import user guide
- [ ] PLAN-016: Update validation README
- [ ] PLAN-017: Update database README
- [ ] PLAN-018: Update epic completion report
- [ ] PLAN-019: Add ADR for constraint evolution
- [ ] **FINAL**: Run full test suite and verify all acceptance criteria
